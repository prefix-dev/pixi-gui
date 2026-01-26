import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Row } from "@/components/common/row";

interface SortableRowProps {
  id: string;
  title: string;
  subtitle?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
  disabled?: boolean;
}

export function SortableRow({
  id,
  title,
  subtitle,
  prefix,
  suffix,
  disabled,
}: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  return (
    <Row
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? "opacity-80" : undefined}
      title={title}
      subtitle={subtitle}
      prefix={
        <>
          <div
            className="-ms-pfx-xs me-pfx-xs cursor-grab rounded-full p-1 outline-none active:cursor-grabbing focus-visible:bg-pfxgsl-200 dark:focus-visible:bg-pfxgsd-600"
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="text-pfxgsl-400" />
          </div>
          {prefix}
        </>
      }
      suffix={suffix}
    />
  );
}
