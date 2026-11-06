import type { ButtonHTMLAttributes } from 'react'
import { LoaderCircle } from 'lucide-react'
import { Link, type LinkProps } from 'react-router'
import { buttonClass, type ButtonStyle } from './buttonClass'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyle {
  /** Shows a spinner and blocks presses. */
  loading?: boolean
}

export function Button({ variant, size, block, loading, disabled, className, children, type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, block }, className)}
      {...props}
    >
      {loading && <LoaderCircle className="size-[1.1em] animate-spin" />}
      {children}
    </button>
  )
}

/** A link that looks like a button. */
export function ButtonLink({ variant, size, block, className, ...props }: LinkProps & ButtonStyle) {
  return <Link viewTransition className={buttonClass({ variant, size, block }, className)} {...props} />
}
