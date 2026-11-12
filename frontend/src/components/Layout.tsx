import { Link, Outlet } from 'react-router';
import { AccountMenu } from './AccountMenu';
import { Brand } from './Brand';
import { DeviceFooter } from './DeviceFooter';
import { SplitterNav } from './SplitterNav';
import { Icon } from './ui';
import { authEnabled } from '../lib/auth';
import { btn } from '../lib/styles';
import { useIsDesktop } from '../lib/useIsDesktop';

/**
 * Phone: a slim top bar and one column, like a mobile app.
 * Desktop: a sidebar with the user's splitters next to a wider page.
 */
export function Layout() {
  const isDesktop = useIsDesktop();

  if (isDesktop) {
    return (
      <div className="flex min-h-dvh">
        <aside className="glass sticky top-3 m-3 mr-0 flex h-[calc(100dvh-1.5rem)] w-72 shrink-0 flex-col gap-5 rounded-3xl px-4 py-5">
          <div className="flex items-center justify-between px-2">
            <Brand />
          </div>
          <Link to="/new" className={`${btn.primary} w-full`}>
            <Icon name="plus" />
            New splitter
          </Link>
          <SplitterNav />
          <div className="mt-auto flex flex-col gap-3 border-t border-glass-border pt-4">
            {authEnabled && (
              <div className="px-2">
                <AccountMenu showName />
              </div>
            )}
            <DeviceFooter />
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-8 py-8">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass-strong sticky top-0 z-30 rounded-none border-x-0 border-t-0">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <Brand />
          {authEnabled && <AccountMenu />}
        </div>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-4 pb-10">
        <Outlet />
      </main>
      {/* Room below, so the floating "New" button never covers the footer. */}
      <div className="pb-24">
        <DeviceFooter />
      </div>
    </div>
  );
}
