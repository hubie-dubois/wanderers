# Monitoring Checklist

## Quick health check (30 seconds)

Run:

```bash
cd /Users/christopherfiorillo/Documents/github/wanderers
./scripts/healthcheck.sh
```

Expected:
- Site returns `HTTP 200`
- Edge function `OPTIONS` returns `HTTP 200`

## Verify GitHub Pages config

```bash
gh api repos/hubie-dubois/wanderers/pages
```

Check these fields:
- `status: "built"`
- `cname: "wanderers.hubiedubois.com"`
- `https_enforced: true`
- `source.branch: "main"`

## Spot-check function behavior

From browser on your live site:
- Valid submit (captcha solved) succeeds
- Submit without captcha fails

## Optional weekly checks

- Review Supabase project logs for bursts/errors
- Confirm Cloudflare DNS still points `wanderers.hubiedubois.com` correctly
