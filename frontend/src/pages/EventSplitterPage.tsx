import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation } from '@apollo/client/react';
import { MY_SPLITTERS, SPLITTER_FOR_EVENT, type Splitter } from '../graphql/splitters';
import { SignInPrompt } from '../components/SignInPrompt';
import { useAuthState } from '../lib/useAuthState';
import { Card, EmptyState, Loading } from '../components/ui';
import { btn } from '../lib/styles';

/**
 * Where Event Manager's "Split costs" button lands (/events/:eventId). Opens the event's
 * splitter, creating it from the event the first time.
 */
export function EventSplitterPage() {
  const { isLoaded, isSignedIn } = useAuthState();
  if (!isLoaded) return null;
  if (!isSignedIn) {
    return (
      <div className="pt-6">
        <SignInPrompt message="Sign in with your Event Manager account to split costs for this event." />
      </div>
    );
  }
  return <OpenEventSplitter />;
}

function OpenEventSplitter() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [splitterForEvent] = useMutation<{ splitterForEvent: Splitter }>(SPLITTER_FOR_EVENT, {
    refetchQueries: [MY_SPLITTERS],
  });
  // Run once, also under StrictMode's double effects; the backend copes with a second call anyway.
  const started = useRef(false);

  useEffect(() => {
    if (started.current || !eventId) return;
    started.current = true;
    splitterForEvent({
      variables: {
        eventManagerEventId: eventId,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    })
      .then(({ data }) => {
        if (data) navigate(`/s/${data.splitterForEvent.id}`, { replace: true });
      })
      .catch((e: Error) => setError(e.message));
  }, [eventId, navigate, splitterForEvent]);

  if (error) {
    return (
      <Card>
        <EmptyState
          icon="📅"
          title="Could not open this event's splitter"
          action={
            <Link to="/" className={btn.secondary}>
              Go to my splitters
            </Link>
          }
        >
          {error}
        </EmptyState>
      </Card>
    );
  }
  return <Loading label="Opening the splitter for this event…" />;
}
