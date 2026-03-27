import { Home, LayoutGrid, Radio, Library, Search } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'new', label: 'New', icon: LayoutGrid },
  { id: 'radio', label: 'Radio', icon: Radio },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'search', label: 'Search', icon: Search },
];

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <nav className="bottom-nav">
      <div className="nav-menu">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`nav-item${activeTab === item.id ? ' active' : ''}`}
            onClick={() => onTabChange(item.id)}
            aria-label={item.label}
          >
            <item.icon size={22} className="icon" />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
