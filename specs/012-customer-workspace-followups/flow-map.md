# Existing flow observations and intended routes

Inspected 2026-10-05 on base aff70c8. This is a code/screenshot inspection, not user research.

| Current observation                                                                   | Evidence                                                                                   | Intended change                                                                      |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Admin opens on collection tiles with no next action                                   | test-results/admin.png from the #36 browser run; payload.config.ts has no custom dashboard | Enquiries inbox at /admin with new/waiting/upcoming/attention filters                |
| Contact history sits below editable contact fields and splits related work into links | CustomerTimeline.tsx; customer-timeline-mobile.png                                         | Dedicated customer workspace with request, conversation and actions visible together |
| Proposal, booking and exact email preview require different collection pages          | EnquiryActions.tsx, BookingActions.tsx, EmailComposer.tsx, EmailMessagePreview.tsx         | In-context guided forms and previews, with native records secondary                  |
| Empty template list and failed loading look alike                                     | EmailComposer.tsx suppresses fetch errors                                                  | Separate loading/error/empty states with Retry and a template-management link        |
| History is honest but technical detail dominates                                      | Raw details/variables/units in current admin controls                                      | Human-readable summaries; technical/provider details under secondary disclosure      |
| Follow-ups are only new/contacted/closed flags, not a schedule                        | Enquiries.ts; no jobs configuration in payload.config.ts                                   | Private planned messages with purpose/timezone/preview/state and revision history    |
| External replies and automatic dispatch are not active                                | customerView limitations; sendEmailMessage rejects customer_draft                          | Visible capability status; disabled inbound boundary and explicit test simulations   |

Main journey: inbox → selected enquiry/customer → prepare reply or proposal → review exact
private draft → plan follow-up → edit/pause/cancel/reschedule → return to inbox. The
customer header and selected enquiry persist throughout. Booking confirmation/reply/stop
updates visibly explain which plans were blocked, cancelled or replaced.

Mobile places the primary action after the enquiry summary, keeps touch targets and focus
visible, and stacks history, booking and plans without horizontal scrolling. Tests cover
back/cancel before save, stable repeated-click identity, failed writes with retained input,
expired authentication and blocked automatic sending. Content names/search terms remain
private, are not placed into URLs, and generate no analytics events.
