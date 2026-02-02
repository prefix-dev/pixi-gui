<h2>
  <a href="https://github.com/prefix-dev/pixi-gui/">
  </a>
</h2>

<h2 align="center">

![License][license-badge]
[![Project Chat][chat-badge]][chat-url]
[![Pixi Badge][pixi-badge]][pixi-url]

[license-badge]: https://img.shields.io/badge/license-FSL--1.1--MIT-blue?style=flat-square
[chat-badge]: https://img.shields.io/discord/1082332781146800168.svg?label=&logo=discord&logoColor=ffffff&color=7389D8&labelColor=6A7EC2&style=flat-square
[chat-url]: https://discord.gg/kKV8ZxyzY4
[pixi-badge]: https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/prefix-dev/pixi/main/assets/badge/v0.json&style=flat-square
[pixi-url]: https://pixi.sh

</h2>

# Pixi GUI (Preview)

A graphical user interface for [Pixi](https://pixi.sh), the cross-platform package manager built on the conda ecosystem. Developed with love at [prefix.dev](https://prefix.dev).

<img width="1316" height="844" alt="pixi_gui_task_overview" src="https://github.com/user-attachments/assets/d6e8bdc4-93a9-4bc8-a313-a0528038b4e0" />

For more information checkout the Pixi GUI [announcement blog post at prefix.dev](https://prefix.dev/blog/introducing-pixi-gui-preview)!

## Installation

Pixi GUI is available for Windows, macOS (Intel + Apple Silicon) and Linux. Install from our [pixi-gui prefix.dev channel](https://prefix.dev/channels/pixi-gui/packages/pixi-gui):

```shell
pixi global install pixi-gui --channel https://prefix.dev/pixi-gui -channel https://prefix.dev/conda-forge
```

Alternatively you can install Pixi GUI from source:

```shell
pixi global install --path .
```

## Development

### Running

```shell
pixi run app
```

This will install all frontend dependencies via pnpm and start the Tauri development server.

### Linting

```shell
pixi run lint
```

Runs all linters and formatters for both backend (`clippy`, `rustfmt`) and frontend (`eslint`, `prettier`), plus additional checks like taplo, `ruff`, and `typos`.

### Packaging

```shell
pixi run build-package
```

Builds a installable conda package using rattler-build.



## Support

Got questions or ideas, or just want to chat? Join our lively conversations on Discord. We're very active and would be happy to welcome you to our community. [Join our Discord server today!][chat-url]
