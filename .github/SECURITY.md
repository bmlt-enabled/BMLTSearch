# Security Policy

## Supported Versions

Only the latest release of BMLT Search receives security updates.

| Version | Supported |
| ------- | --------- |
| latest  | ✅        |
| older   | ❌        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email your report to **admin [at] bmlt [dot] app** with the subject line
`[BMLTSearch] Security Vulnerability`.

Include as much of the following as you can:

- A description of the vulnerability and its potential impact
- Steps to reproduce or a proof-of-concept
- Any suggested mitigations

You should receive a response within **72 hours**. We will keep you informed as
we work toward a fix and will credit you in the release notes unless you prefer
to remain anonymous.

## Before you report: the Google Maps keys are public by design

The most common report we expect is "your API key is exposed in the JavaScript
bundle." It is, deliberately, and this is not a vulnerability in itself.

Google Maps keys used by a browser or a mobile app are **client-side
credentials**. They are sent by the client on every request and there is no way
to hide one in a web app or in an installable binary — extracting it from an APK
or an IPA is trivial regardless of where it is stored. Google's own guidance is
to treat these keys as public and to control them with **restrictions rather
than secrecy**:

- Each key carries exactly one _application_ restriction — HTTP referrers for the
  web key, bundle ID for iOS, package name + signing certificate SHA-1 for
  Android. A key lifted from our bundle will not authorize requests from anywhere
  else.
- Each key is restricted to the specific APIs it needs, so it cannot be used to
  bill other Google services.
- Separate keys are used for local development and production, so neither
  referrer list has to carry the other's origins.

A report is genuinely useful if you can show one of these controls is **missing
or ineffective** — for example a key that authorizes requests from an origin or
application we do not control, or one that is not API-restricted.

Note that a stronger design exists and is documented as open work in
[CONTRIBUTING.md](CONTRIBUTING.md): proxying Places and Geocoding through a
server that holds the key. It would not remove the key from the app, because the
map view needs it in-process either way.

## Scope

In scope:

- This repository's source, build, and release workflows
- The web app at [app.bmlt.app](https://app.bmlt.app)
- The iOS and Android applications built from this repository

Out of scope:

- The BMLT root servers themselves (`aggregator.bmltenabled.org`,
  `bmlt.virtual-na.org`) — report those to the [BMLT
  project](https://bmlt.app/)
- Google Maps Platform infrastructure
- Meeting data content, which comes from the root servers and is maintained by
  service bodies
