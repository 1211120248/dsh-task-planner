export type IconName = 'check' | 'calendar' | 'inbox' | 'sun' | 'future' | 'archive' | 'briefcase' | 'user' | 'search' | 'plus' | 'close' | 'clock' | 'bell' | 'trash' | 'repeat' | 'menu' | 'settings' | 'download' | 'upload' | 'sparkle' | 'undo' | 'chevron'

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true as const }
  switch (name) {
    case 'check': return <svg {...common}><path d="m5.5 12.5 4 4 9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'calendar': return <svg {...common}><rect x="3.5" y="5" width="17" height="15" rx="3" stroke="currentColor" strokeWidth="1.6" /><path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    case 'inbox': return <svg {...common}><path d="M4 5.5h16v13H4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M4 13h4l1.5 2h5l1.5-2h4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
    case 'sun': return <svg {...common}><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    case 'future': return <svg {...common}><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" /><path d="M12 7v5l3.5 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    case 'archive': return <svg {...common}><path d="M5 7h14v13H5zM4 4h16v3H4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M9 11h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    case 'briefcase': return <svg {...common}><rect x="3.5" y="7" width="17" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.6" /><path d="M9 7V4.5h6V7M4 12h16" stroke="currentColor" strokeWidth="1.6" /></svg>
    case 'user': return <svg {...common}><circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" /><path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    case 'search': return <svg {...common}><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" strokeWidth="1.6" /><path d="m15.5 15.5 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    case 'plus': return <svg {...common}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
    case 'close': return <svg {...common}><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
    case 'clock': return <svg {...common}><circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" /><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    case 'bell': return <svg {...common}><path d="M18 9a6 6 0 0 0-12 0c0 6-3 7-3 8h18c0-1-3-2-3-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M10 20h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
    case 'trash': return <svg {...common}><path d="M5 7h14M9 7V4h6v3M8 10v8M12 10v8M16 10v8M7 7l1 14h8l1-14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'repeat': return <svg {...common}><path d="M17 3l3 3-3 3M4 10V8a2 2 0 0 1 2-2h14M7 21l-3-3 3-3M20 14v2a2 2 0 0 1-2 2H4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'menu': return <svg {...common}><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
    case 'settings': return <svg {...common}><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.5 1a8 8 0 0 0-2-1.2L14 3h-4l-.4 2.6a8 8 0 0 0-2 1.2l-2.5-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.5-1a8 8 0 0 0 2 1.2L10 21h4l.4-2.6a8 8 0 0 0 2-1.2l2.5 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
    case 'download': return <svg {...common}><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 20h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'upload': return <svg {...common}><path d="M12 17V5m0 0 4 4m-4-4L8 9M5 20h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'sparkle': return <svg {...common}><path d="M12 3c.6 4.7 3.3 7.4 8 8-4.7.6-7.4 3.3-8 8-.6-4.7-3.3-7.4-8-8 4.7-.6 7.4-3.3 8-8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>
    case 'undo': return <svg {...common}><path d="M9 7 5 11l4 4M5 11h8a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
    case 'chevron': return <svg {...common}><path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
  }
}
