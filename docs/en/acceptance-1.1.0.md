# DSH-Optimization 1.1.0 acceptance

[简体中文](../acceptance-1.1.0.md) · English

This release includes Ultimate-Model **1.5.0**, with the same preset ID, `ultimate-model`. The DSH version declaration is `*`; the Host still needs to provide either the legacy tool presentation interface or the newer scoped executor. An unknown interface produces a load error.

| Evidence | Scope and criteria |
| --- | --- |
| Source and regression tests | Component tests cover both paging interfaces, settled activation, session isolation, Host module resolution, and installation boundaries. Root tests separately cover the workflow installer, metadata transactions, and repair utilities. |
| Installed Host | Windows x64 with DSH NEXT 2.0.24-next / Harness 0.2.2-rc.5. Install through the official manager into a separate Home/profile and check the enabled bundle, its link, and its version. Create standard and Ultimate sessions. Restart the isolated Host after removal and confirm that Ultimate is absent and standard remains available. |
| Native paging | The provider and the PPT and MiniMax tool definitions are isolated local fixtures. Verify that the first request hides the groups while retaining activation hints, same-batch calls are denied, settled activation affects the next request, unknown groups are rejected, and another session keeps its own page. Token estimates depend on the fixture's schemas and do not establish production usage or billing. |
| Other Hosts and user state | Regressions cover the legacy interface; Host module probes cover 0.2.2-rc.5 and the pinned 0.2.3-alpha.2. This does not certify all old or future Hosts, PTC with a real provider, or other platforms. The test uses no production profile, accounts, credentials, user sessions, or paid model. |

The release includes two ZIP files and their SHA256 files, a build JSON with the source commit, and a separate installation receipt from fresh extractions of the final archives. Use the commit and digests in those attachments to match evidence to a particular download.

See [first installation](getting-started.md) or [deployment and recovery](deployment.md) for existing profiles and same-ID overrides. The [1.0.0 acceptance report](acceptance.md) and [historical model trials](real-model-validation.md) apply to their original artifacts.
