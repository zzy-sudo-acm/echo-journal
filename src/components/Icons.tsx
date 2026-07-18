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
