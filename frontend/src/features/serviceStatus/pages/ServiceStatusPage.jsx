import ErrorPage from '../../../components/errors/ErrorPage';
import { formatDueAt } from '../../jobOrders/workTime';

const iconProps = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, viewBox: '0 0 24 24', 'aria-hidden': true };

const WrenchIcon = () => (
  <svg {...iconProps}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.65 2.65 0 0021 17.25l-5.88-5.88M11.42 15.17l2.5-3.03c.31-.38.73-.62 1.2-.76.55-.16 1.16-.18 1.73-.13a4.5 4.5 0 004.5-6.15l-3.28 3.28a3 3 0 01-2.25-2.25l3.28-3.28a4.5 4.5 0 00-6.15 4.5c.05.57.03 1.18-.13 1.73-.14.47-.38.89-.76 1.2l-.21.17m-.43 4.72L6.14 20.04a2.28 2.28 0 11-3.22-3.22l5.62-5.05" />
  </svg>
);

const CardIcon = () => (
  <svg {...iconProps}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
  </svg>
);

const LockIcon = () => (
  <svg {...iconProps}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const StoreIcon = () => (
  <svg {...iconProps}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.35m-16.5 11.65V9.35m0 0a3 3 0 003.75-.62 3 3 0 004.5 0 3 3 0 004.5 0 3 3 0 003.75.62m-16.5 0a3 3 0 01-.62-4.72L4.2 3.44A1.5 1.5 0 015.26 3h13.48a1.5 1.5 0 011.06.44l1.19 1.19a3 3 0 01-.62 4.72M6.75 18h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .41.34.75.75.75z" />
  </svg>
);

// What each state says when no message of its own was written.
const PAGES = {
  maintenance: {
    icon: <WrenchIcon />,
    title: 'Under maintenance',
    description: "We're making some improvements. Please check back soon.",
  },
  paymentDue: {
    icon: <CardIcon />,
    title: 'Payment pending',
    description: 'Your payment for the system is pending. Please contact us to continue using it.',
  },
  unavailable: {
    icon: <LockIcon />,
    title: 'System unavailable',
    description: 'The system is not available right now. Please contact your owner.',
  },
  shopClosed: {
    icon: <StoreIcon />,
    title: 'Shop closed',
    description: 'The shop is closed for now.',
  },
};

/**
 * The whole screen while the app isn't open for this person: maintenance,
 * payment pending (the owner), unavailable (a user, while the payment is
 * pending) or shop closed (a user) - with the message written for it and,
 * for a closed shop, when it opens again or that the owner opens it by hand.
 *
 * @param {Object} props
 * @param {{ state: string, message: string|null, resumeAt?: string|null, opensAutomatically?: boolean }} props.block
 * @param {() => void} props.onCheckAgain
 * @param {(() => void)|null} [props.onLogout] - Logged in only
 */
const ServiceStatusPage = ({ block, onCheckAgain, onLogout = null }) => {
  const page = PAGES[block.state] || PAGES.unavailable;
  const isShop = block.state === 'shopClosed';

  return (
    <ErrorPage
      icon={page.icon}
      title={page.title}
      description={block.message || page.description}
      primaryAction={{ label: 'Check again', onClick: onCheckAgain }}
      secondaryAction={onLogout ? { label: 'Log out', onClick: onLogout } : undefined}
    >
      {isShop && (
        <div className="mt-8 rounded-xl bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          {block.resumeAt ? (
            <>
              <p className="font-medium">Expected to open again</p>
              <p className="mt-0.5 text-base font-semibold">{formatDueAt(block.resumeAt)}</p>
              <p className="mt-1 text-xs text-indigo-700">This page opens the app by itself at that time.</p>
            </>
          ) : (
            <>
              <p className="font-medium">No time to open again was given.</p>
              <p className="mt-0.5 text-xs text-indigo-700">The owner needs to open the system again manually.</p>
            </>
          )}
        </div>
      )}
    </ErrorPage>
  );
};

export default ServiceStatusPage;
