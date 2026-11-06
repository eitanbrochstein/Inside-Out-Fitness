import { extendTailwindMerge, type ClassNameValue } from 'tailwind-merge'

// tailwind-merge has to know this app's tokens (src/styles/tokens.css): otherwise `text-callout`
// reads as a colour and `rounded-card` as unknown, and a className passed to a component loses to
// the component's own class by CSS order instead of replacing it.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display', 'title', 'title-2', 'title-3', 'headline', 'body', 'callout', 'subhead', 'footnote', 'caption', 'micro'],
      radius: ['card', 'tile', 'field', 'button', 'sheet'],
      shadow: ['card', 'float'],
      font: ['sans', 'display'],
      ease: ['smooth', 'spring'],
      animate: ['shimmer', 'rise', 'pop', 'drift'],
    },
    classGroups: {
      pt: [{ pt: ['safe'] }],
      pb: [{ pb: ['safe'] }],
    },
  },
})

/** Joins class names; later ones replace earlier ones that set the same thing. */
export const cn = (...classes: ClassNameValue[]) => twMerge(...classes)
