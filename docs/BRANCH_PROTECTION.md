# Branch Protection Setup

To require the Pulumi preview to pass before merging pull requests into `main`:

## 1. Configure Branch Protection

1. Go to **Settings** → **Branches** → **Branch protection rules**
2. Add or edit the rule for `main`
3. Enable **Require status checks to pass before merging**
4. Search for and select **Pulumi Preview** as a required status check
5. Save the rule

## 2. Required Secrets

The Pulumi Preview workflow needs these repository secrets:

- `PULUMI_ACCESS_TOKEN` – Pulumi Cloud API token
- `PULUMI_STACK_NAME` – Stack to preview (e.g. `dev`)

Without these, the workflow will fail and PRs cannot be merged until they are configured.

## 3. Merge Queue (Optional)

For stricter merge control, enable the [merge queue](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/incorporating-changes-from-a-pull-request/merging-a-pull-request-with-a-merge-queue):

1. **Settings** → **General** → **Pull Requests**
2. Enable **Allow merge queues**
3. Add the merge queue to your branch protection rule

The Pulumi Preview workflow runs on `merge_group`, so it will execute when a PR enters the merge queue.
