//! The `#[command]` attribute and `generate_handler!` for backend commands of `pixi_gui_server`.

use std::collections::HashSet;

use proc_macro::TokenStream;
use proc_macro2::Span;
use quote::{format_ident, quote};
use syn::{
    Error, FnArg, Ident, ItemFn, Pat, Path, ReturnType, Token, Type, bracketed,
    parse::{Parse, ParseStream},
    parse_macro_input,
    punctuated::Punctuated,
    spanned::Spanned,
};

/// Makes a function callable through `pixi_gui_server::dispatch`, like `#[tauri::command]`.
///
/// The function stays unchanged. Next to it, a hidden handler `__cmd__<name>` is generated which
/// reads each parameter from the JSON args object (keyed by the camelCase parameter name, as Tauri
/// does), calls the function and serializes its return value.
///
/// - A parameter of type `Ctx` receives the command context instead of an argument.
/// - `&str` parameters are read as `String`.
/// - The return value may be any `Serialize` type, or a `Result` whose error converts into
///   `crate::error::Error`.
#[proc_macro_attribute]
pub fn command(attr: TokenStream, item: TokenStream) -> TokenStream {
    if !attr.is_empty() {
        return Error::new(Span::call_site(), "#[command] takes no arguments")
            .to_compile_error()
            .into();
    }

    let function = parse_macro_input!(item as ItemFn);
    match handler(&function) {
        Ok(handler) => quote! { #function #handler }.into(),
        Err(err) => {
            let err = err.to_compile_error();
            quote! { #function #err }.into()
        }
    }
}

/// Dispatches a command call to one of the listed `#[command]` functions, like
/// `tauri::generate_handler!`.
///
/// ```ignore
/// generate_handler!(ctx, cmd, args, [add::add_conda_deps, pty::pty_list])
/// ```
///
/// Expands to a `match` on `cmd` (the function name) that awaits the command's hidden handler, or
/// returns `DispatchError::UnknownCommand`. Must be used inside an `async` function.
#[proc_macro]
pub fn generate_handler(input: TokenStream) -> TokenStream {
    let HandlerInput {
        ctx,
        cmd,
        args,
        commands,
    } = parse_macro_input!(input as HandlerInput);

    let mut names = HashSet::new();
    let mut arms = Vec::new();
    for command in commands {
        let Some(last) = command.segments.last() else {
            continue;
        };
        let name = last.ident.to_string();
        if !names.insert(name.clone()) {
            return Error::new(command.span(), format!("command `{name}` is listed twice"))
                .to_compile_error()
                .into();
        }

        let mut handler = command.clone();
        if let Some(last) = handler.segments.last_mut() {
            last.ident = format_ident!("__cmd__{}", last.ident);
        }
        arms.push(quote! { #name => #handler(#ctx, #args).await, });
    }

    quote! {
        match #cmd {
            #(#arms)*
            _ => ::std::result::Result::Err(
                crate::router::DispatchError::UnknownCommand(#cmd.to_string())
            ),
        }
    }
    .into()
}

/// `ctx, cmd, args, [path, path, ...]`
struct HandlerInput {
    ctx: Ident,
    cmd: Ident,
    args: Ident,
    commands: Punctuated<Path, Token![,]>,
}

impl Parse for HandlerInput {
    fn parse(input: ParseStream) -> syn::Result<Self> {
        let ctx = input.parse()?;
        input.parse::<Token![,]>()?;
        let cmd = input.parse()?;
        input.parse::<Token![,]>()?;
        let args = input.parse()?;
        input.parse::<Token![,]>()?;

        let content;
        bracketed!(content in input);
        let commands = Punctuated::parse_terminated(&content)?;

        Ok(Self {
            ctx,
            cmd,
            args,
            commands,
        })
    }
}

fn handler(function: &ItemFn) -> syn::Result<proc_macro2::TokenStream> {
    let sig = &function.sig;
    let name = &sig.ident;
    let vis = &function.vis;
    let handler_name = format_ident!("__cmd__{}", name);
    let cmd = name.to_string();

    let mut reads = Vec::new();
    let mut call_args = Vec::new();
    let mut uses_ctx = false;

    for input in &sig.inputs {
        let FnArg::Typed(input) = input else {
            return Err(Error::new(input.span(), "commands can't take `self`"));
        };
        let Pat::Ident(pat) = &*input.pat else {
            return Err(Error::new(
                input.pat.span(),
                "command parameters must be plain identifiers",
            ));
        };

        if is_ctx(&input.ty) {
            if uses_ctx {
                return Err(Error::new(
                    input.span(),
                    "only one `Ctx` parameter is allowed",
                ));
            }
            uses_ctx = true;
            call_args.push(quote! { __ctx.clone() });
            continue;
        }

        let local = format_ident!("__arg_{}", pat.ident);
        let key = camel_case(&pat.ident);
        let (ty, pass) = match &*input.ty {
            Type::Reference(reference) if is_str(&reference.elem) => {
                (quote! { ::std::string::String }, quote! { &#local })
            }
            Type::Reference(reference) => {
                return Err(Error::new(
                    reference.span(),
                    "reference parameters other than `&str` are not supported",
                ));
            }
            ty => (quote! { #ty }, quote! { #local }),
        };

        reads.push(quote! {
            let #local: #ty = crate::router::arg(&mut __args, #cmd, #key)?;
        });
        call_args.push(pass);
    }

    let call = if sig.asyncness.is_some() {
        // Boxed, so the dispatch future doesn't get as large as the largest command future
        quote! { ::std::boxed::Box::pin(#name(#(#call_args),*)).await }
    } else {
        quote! { #name(#(#call_args),*) }
    };

    let respond = if returns_result(&sig.output) {
        quote! { crate::router::respond(#call) }
    } else {
        quote! { crate::router::respond(::std::result::Result::<_, crate::error::Error>::Ok(#call)) }
    };

    let ctx_unused = (!uses_ctx).then(|| quote! { let _ = &__ctx; });

    Ok(quote! {
        #[doc(hidden)]
        #[allow(non_snake_case, unused_mut)]
        #vis async fn #handler_name(
            __ctx: crate::context::Ctx,
            mut __args: ::serde_json::Value,
        ) -> ::std::result::Result<::serde_json::Value, crate::router::DispatchError> {
            #ctx_unused
            #(#reads)*
            #respond
        }
    })
}

fn last_segment_is(ty: &Type, name: &str) -> bool {
    matches!(ty, Type::Path(path) if path.path.segments.last().is_some_and(|s| s.ident == name))
}

fn is_ctx(ty: &Type) -> bool {
    last_segment_is(ty, "Ctx")
}

fn is_str(ty: &Type) -> bool {
    last_segment_is(ty, "str")
}

fn returns_result(output: &ReturnType) -> bool {
    matches!(output, ReturnType::Type(_, ty) if last_segment_is(ty, "Result"))
}

/// `dep_options` -> `depOptions`, matching Tauri's argument naming.
fn camel_case(ident: &Ident) -> String {
    let mut out = String::new();
    let mut upper = false;
    for c in ident.to_string().chars() {
        if c == '_' {
            upper = !out.is_empty();
        } else if upper {
            out.extend(c.to_uppercase());
            upper = false;
        } else {
            out.push(c);
        }
    }
    out
}
