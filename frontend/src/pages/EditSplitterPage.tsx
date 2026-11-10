import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery } from '@apollo/client/react';
import { GET_SPLITTER, UPDATE_SPLITTER, type Splitter } from '../graphql/splitters';
import { SplitterForm } from '../components/SplitterForm';
import type { SplitterFormValues } from '../lib/splitterForm';
import { SignInPrompt } from '../components/SignInPrompt';
import { Icon, Loading } from '../components/ui';
import { btn } from '../lib/styles';
import { useAuthState } from '../lib/useAuthState';

export function EditSplitterPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isLoaded, isSignedIn } = useAuthState();
  const [error, setError] = useState<string | null>(null);
  const { data, loading } = useQuery<{ splitter: Splitter | null }>(GET_SPLITTER, {
    variables: { id },
    skip: !isSignedIn,
  });
  const [updateSplitter, { loading: saving }] = useMutation(UPDATE_SPLITTER);

  if (!isLoaded || loading) return <Loading />;
  if (!isSignedIn) return <SignInPrompt message="Sign in to edit this splitter." />;
  const splitter = data?.splitter;
  if (!splitter?.isAdmin) {
    return <p className="pt-6 text-muted-foreground">Only the admin can edit this splitter.</p>;
  }

  const submit = async (values: SplitterFormValues) => {
    setError(null);
    try {
      await updateSplitter({
        variables: {
          id: splitter.id,
          input: {
            name: values.name,
            description: values.description || null,
            type: values.type,
            coverEmoji: values.coverEmoji || null,
            startDate: values.startDate || null,
            endDate: values.endDate || null,
            currency: values.currency,
            hasInitialFund: values.hasInitialFund,
          },
        },
      });
      navigate(`/s/${splitter.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-1">
        <Link to={`/s/${splitter.id}`} aria-label="Back" className={`${btn.icon} -ml-2`}>
          <Icon name="back" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Edit splitter</h1>
      </div>
      <SplitterForm
        initial={{
          name: splitter.name,
          description: splitter.description ?? '',
          type: splitter.type,
          coverEmoji: splitter.coverEmoji ?? '',
          startDate: splitter.startDate ?? '',
          endDate: splitter.endDate ?? '',
          currency: splitter.currency,
          hasInitialFund: splitter.hasInitialFund,
        }}
        currencyHint="Can be changed until the first transaction is added."
        submitLabel="Save"
        submitting={saving}
        error={error}
        onSubmit={submit}
      />
    </div>
  );
}
