import { Link, Outlet } from 'react-router';
import { AccountMenu } from './AccountMenu';
import { DeviceFooter } from './DeviceFooter';
import { authEnabled } from '../lib/auth';

export function Layout() {
  return (
    <>
      <header className="mx-auto flex max-w-xl items-center justify-between p-4">
        <Link to="/" className="text-lg font-semibold">
          Bill Splitter
        </Link>
        {authEnabled && <AccountMenu />}
      </header>
      <main className="mx-auto max-w-xl px-4 pb-12">
        <Outlet />
      </main>
      <DeviceFooter />
    </>
  );
}
