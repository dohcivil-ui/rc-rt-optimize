import { NavLink, Outlet } from 'react-router-dom';

function Layout() {
  // active link gets blue underline; inactive stays slate
  var linkClass = function (info) {
    var base = 'px-3 py-2 text-sm font-medium transition-colors';
    return info.isActive
      ? base + ' text-blue-600 border-b-2 border-blue-600'
      : base + ' text-slate-600 hover:text-slate-900';
  };

  return (
    <div className='min-h-screen bg-slate-50'>
      <nav className='bg-white border-b border-slate-200 shadow-sm'>
        <div className='max-w-5xl mx-auto px-4 flex items-center gap-2'>
          <span className='font-bold text-slate-900 mr-4 py-3'>rcopt</span>
          <NavLink to='/' end className={linkClass}>Hero</NavLink>
          <NavLink to='/input' className={linkClass}>Input</NavLink>
          <NavLink to='/review' className={linkClass}>Review</NavLink>
          <NavLink to='/result' className={linkClass}>Result</NavLink>
          <NavLink to='/explain' className={linkClass}>Explain</NavLink>
        </div>
      </nav>
      <main className='max-w-5xl mx-auto'>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
