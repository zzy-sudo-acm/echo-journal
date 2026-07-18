import { NavLink } from 'react-router-dom'
import { HomeIcon, CalendarIcon, SearchIcon, ClockIcon, SettingsIcon } from './Icons'

const navItems = [
  { to: '/', icon: HomeIcon, label: '今天' },
  { to: '/calendar', icon: CalendarIcon, label: '日历' },
  { to: '/search', icon: SearchIcon, label: '搜索' },
  { to: '/review', icon: ClockIcon, label: '回顾' },
  { to: '/settings', icon: SettingsIcon, label: '设置' },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) => (isActive ? 'active' : '')}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
