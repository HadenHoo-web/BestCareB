import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';
const variants = cva('inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 disabled:pointer-events-none disabled:opacity-40', { variants: { variant: { default: 'bg-teal-700 text-white hover:bg-teal-800', outline: 'border border-current/15 hover:bg-black/5 dark:hover:bg-white/5', ghost: 'hover:bg-black/5 dark:hover:bg-white/5' }, size: { default: 'h-10 px-4', icon: 'h-10 w-10' } }, defaultVariants: { variant: 'default', size: 'default' } });
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild = false, ...props }, ref) => { const Comp = asChild ? Slot : 'button'; return <Comp className={cn(variants({ variant, size }), className)} ref={ref} {...props} />; });
Button.displayName = 'Button';
