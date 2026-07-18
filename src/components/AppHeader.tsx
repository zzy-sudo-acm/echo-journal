import { Link } from 'react-router-dom'
import { SearchIcon, SettingsIcon } from './Icons'

export function AppHeader() {
  return (
    <header className="app-header">
      <Link className="app-brand" to="/" aria-label="回声日记首页">回声</Link>
      <nav className="app-header-actions" aria-label="快捷导航">
        <Link to="/search"><SearchIcon /><span>搜索</span></Link>
        <Link to="/settings"><SettingsIcon /><span>设置</span></Link>
      </nav>
    </header>
  )
}
