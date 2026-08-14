import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function iconProps(props: IconProps): IconProps {
  const { className = '', ...rest } = props
  return {
    className: `icon ${className}`.trim(),
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
    ...rest,
  }
}

export function HomeIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M4 7.5h16M6.5 12h11M9 16.5h6" /></svg>
}

export function CalendarIcon(props: IconProps) {
  return <svg {...iconProps(props)}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M8 3v4M16 3v4M3.5 9.5h17" /></svg>
}

export function SearchIcon(props: IconProps) {
  return <svg {...iconProps(props)}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
}

export function ClockIcon(props: IconProps) {
  return <svg {...iconProps(props)}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3.2 2" /></svg>
}

export function SettingsIcon(props: IconProps) {
  return <svg {...iconProps(props)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.05.05-2.87 2.87-.05-.05A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21h-4v-.05A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.05.05-2.87-2.87.05-.05A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3v-4h.05A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.05-.05 2.87-2.87.05.05A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3h4v.05A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.05-.05 2.87 2.87-.05.05A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21v4h-.05A1.7 1.7 0 0 0 19.4 15Z" /></svg>
}

export function PlusIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M12 5v14M5 12h14" /></svg>
}

export function TrashIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M4 7h16M9 3.5h6M6.5 7l.8 13h9.4l.8-13M10 11v5M14 11v5" /></svg>
}

export function EditIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M13.5 5.5 18.5 10.5M4 20l4.2-1 11-11a2.12 2.12 0 0 0-3-3l-11 11L4 20Z" /></svg>
}

export function CopyIcon(props: IconProps) {
  return <svg {...iconProps(props)}><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>
}

export function DownloadIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M12 3v12M7.5 10.5 12 15l4.5-4.5M4 19.5h16" /></svg>
}

export function UploadIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M12 17V5M7.5 9.5 12 5l4.5 4.5M4 20h16" /></svg>
}

export function ChevronLeftIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="m15 18-6-6 6-6" /></svg>
}

export function ChevronRightIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="m9 18 6-6-6-6" /></svg>
}

export function ChevronDownIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="m6 9 6 6 6-6" /></svg>
}

export function XIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M6 6l12 12M18 6 6 18" /></svg>
}

export function CheckIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="m5 12 4 4L19 6" /></svg>
}

export function PinIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M12 17v5M7 3h10M9 3v6l-3 5h12l-3-5V3" /></svg>
}

export function SunIcon(props: IconProps) {
  return <svg {...iconProps(props)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" /></svg>
}

export function MoonIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M20 15.2A8.5 8.5 0 0 1 8.8 4 8.5 8.5 0 1 0 20 15.2Z" /></svg>
}

export function ShieldIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M12 3 5 6v5c0 4.6 2.7 8.1 7 10 4.3-1.9 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" /></svg>
}

export function TagIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M20 13 13 20l-9-9V4h7l9 9Z" /><circle cx="8" cy="8" r="1" /></svg>
}

export function MoreIcon(props: IconProps) {
  return <svg {...iconProps(props)}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>
}

export function ParagraphIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M14.5 5H10a4 4 0 0 0 0 8h4.5M14.5 5v14M10.5 13v6" /></svg>
}

export function BoldIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M7.5 5h5a3.5 3.5 0 0 1 0 7h-5zM7.5 12h5.7a3.5 3.5 0 0 1 0 7H7.5z" /></svg>
}

export function ItalicIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M10 5h7M7 19h7M14.5 5l-5 14" /></svg>
}

export function QuoteIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M5 11h5v7H4v-5.5A6.5 6.5 0 0 1 10.5 6M14 11h5v7h-6v-5.5A6.5 6.5 0 0 1 19.5 6" /></svg>
}

export function BulletListIcon(props: IconProps) {
  return <svg {...iconProps(props)}><circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="5" cy="17" r="1" fill="currentColor" stroke="none" /><path d="M9 7h10M9 12h10M9 17h10" /></svg>
}

export function OrderedListIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M4 6h1v3M4 9h2M4 12.5c.3-.6.8-.9 1.3-.9.7 0 1.2.4 1.2 1 0 1-2.5 1.8-2.5 3h2.7M10 7h9M10 13h9M10 18h9" /></svg>
}

export function HorizontalRuleIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="M4 12h16" /></svg>
}

export function ImageIcon(props: IconProps) {
  return <svg {...iconProps(props)}><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="8.5" cy="9" r="1.5" /><path d="m5.5 17 4.2-4.2 3.1 3.1 2.2-2.2 3.5 3.3" /></svg>
}

export function UndoIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="m9 8-4 4 4 4M5 12h7.5a5.5 5.5 0 0 1 5.5 5.5" /></svg>
}

export function RedoIcon(props: IconProps) {
  return <svg {...iconProps(props)}><path d="m15 8 4 4-4 4M19 12h-7.5A5.5 5.5 0 0 0 6 17.5" /></svg>
}
