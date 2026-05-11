export function Icon({ name, size = 14, className = '' }) {
  const sw = 1.6;
  const wrap = (children) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className={className}>
      {children}
    </svg>
  );
  switch (name) {
    case 'plus':    return wrap(<><path d="M12 5v14"/><path d="M5 12h14"/></>);
    case 'search':  return wrap(<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>);
    case 'pause':   return wrap(<><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></>);
    case 'play':    return wrap(<path d="M7 5v14l12-7z"/>);
    case 'trash':   return wrap(<><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M6 6l1 14h10l1-14"/></>);
    case 'send':    return wrap(<><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></>);
    case 'chevron': return wrap(<path d="m9 18 6-6-6-6"/>);
    case 'down':    return wrap(<path d="m6 9 6 6 6-6"/>);
    case 'filter':  return wrap(<path d="M3 5h18l-7 9v6l-4-2v-4z"/>);
    case 'copy':    return wrap(<><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></>);
    case 'settings':return wrap(<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>);
    case 'stop':    return wrap(<rect x="6" y="6" width="12" height="12" rx="1.5"/>);
    case 'circle':  return wrap(<circle cx="12" cy="12" r="5"/>);
    case 'bolt':    return wrap(<path d="M13 2 3 14h7l-1 8 10-12h-7z"/>);
    case 'wifi':    return wrap(<><path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19" r="1"/></>);
    case 'globe':   return wrap(<><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/></>);
    case 'plug':    return wrap(<><path d="M9 2v6"/><path d="M15 2v6"/><path d="M5 10h14v3a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z"/><path d="M12 18v4"/></>);
    case 'code':    return wrap(<><path d="m8 6-6 6 6 6"/><path d="m16 6 6 6-6 6"/></>);
    case 'tree':    return wrap(<><circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 6h8"/><path d="M6 8v6a2 2 0 0 0 2 2h8"/></>);
    case 'list':    return wrap(<><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>);
    case 'x':       return wrap(<><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>);
    case 'expand':  return wrap(<><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/></>);
    case 'doc':     return wrap(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>);
    case 'save':    return wrap(<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/></>);
    case 'sparkle': return wrap(<><path d="M12 3v3"/><path d="M12 18v3"/><path d="M3 12h3"/><path d="M18 12h3"/></>);
    default: return null;
  }
}

export function ProtoIcon({ proto, className = '' }) {
  const map = { TCP: 'plug', UDP: 'globe', WS: 'bolt', SER: 'code', MOCK: 'sparkle' };
  return <Icon name={map[proto] || 'globe'} className={className} />;
}
