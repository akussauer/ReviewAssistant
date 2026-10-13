import * as React from 'react'
import { Label as LabelPrimitive } from 'radix-ui'
import { cn } from 'cn'

// shadcn/ui Label.
function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>): React.JSX.Element {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none',
        className
      )}
      {...props}
    />
  )
}

export { Label }
