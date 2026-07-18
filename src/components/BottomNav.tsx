import { NavLink } from 'react-router-dom'
import { HomeIcon, CalendarIcon, SearchIcon, SettingsIcon } from './Icons'

const navItems = [
  { to: '/', icon: HomeIcon, label: '此刻' },
  { to: '/calendar', icon: CalendarIcon, label: '日历' },
  { to: '/search', icon: SearchIcon, label: '搜索' },
  { to: '/settings', icon: SettingsIcon, label: '设置' },
]

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="主要导航">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink key={to} to={to} end={to === '/'}>
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
