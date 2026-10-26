import { useState } from 'react';
import { useNavigate } from 'react-router';
import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';
import { CREATE_SPLITTER, MY_SPLITTERS, type Splitter } from '../graphql/splitters';
import { Field, SplitterForm } from '../components/SplitterForm';
import { emptySplitterForm, inputClass, type SplitterFormValues } from '../lib/splitterForm';
import { SignInPrompt } from '../components/SignInPrompt';
import { useAuthState } from '../lib/useAuthState';

const ME_NAME = gql`
  query MeName {
    me {
      clerkId
      name
    }
  }
`;

/** "Phạm Đăng" → one name per line, empty lines dropped. */
const parseNames = (text: string) =>
  text
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean);

export function CreateSplitterPage() {
  const { isLoaded, isSignedIn } = useAuthState();
  if (!isLoaded) return null;
  if (!isSignedIn) {
    return (
      <div className="pt-6">
        <SignInPrompt message="Sign in to create a splitter. The people who join through your link do not need an account." />
      </div>
    );
  }
  return <CreateSplitterForm />;
}

function CreateSplitterForm() {
  const navigate = useNavigate();
  const { data: me } = useQuery<{ me: { name: string | null } | null }>(ME_NAME);
  // null until edited, so the account name can fill it in once it loads.
  const [adminName, setAdminName] = useState<string | null>(null);
  const [memberNames, setMemberNames] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createSplitter, { loading }] = useMutation<{ createSplitter: Splitter }>(CREATE_SPLITTER, {
    refetchQueries: [MY_SPLITTERS],
  });

  const shownAdminName = adminName ?? me?.me?.name ?? '';
  const memberCount = parseNames(memberNames).length;

  const submit = async (values: SplitterFormValues) => {
    if (!shownAdminName.trim()) return setError('Enter your name in this splitter');
    setError(null);
    try {
      const { data } = await createSplitter({
        variables: {
          input: {
            name: values.name,
            type: values.type,
            coverEmoji: values.coverEmoji || null,
            startDate: values.startDate || null,
            endDate: values.endDate || null,
            currency: values.currency,
            hasInitialFund: values.hasInitialFund,
            adminName: shownAdminName.trim(),
            memberNames: parseNames(memberNames),
          },
        },
      });
      if (data) navigate(`/s/${data.createSplitter.id}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex flex-col gap-4 pt-2">
      <h1 className="text-2xl font-semibold">New splitter</h1>
      <SplitterForm
        initial={emptySplitterForm}
        submitLabel="Create splitter"
        submitting={loading}
        error={error}
        onSubmit={submit}
      >
        <Field label="Your name in this splitter" hint="You will be its admin.">
          <input
            className={inputClass}
            value={shownAdminName}
            onChange={(e) => setAdminName(e.target.value)}
            maxLength={50}
            required
          />
        </Field>
        <Field
          label={`Other members (optional${memberCount ? `, ${memberCount}` : ''})`}
          hint="One name per line. People pick their name when they join, and can still add a new one."
        >
          <textarea
            className={`${inputClass} min-h-28`}
            value={memberNames}
            onChange={(e) => setMemberNames(e.target.value)}
            placeholder={'Minh\nLan\nTuấn'}
          />
        </Field>
      </SplitterForm>
    </div>
  );
}
