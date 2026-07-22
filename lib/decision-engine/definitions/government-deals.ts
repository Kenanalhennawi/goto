// Government Deals decision tree (Phase J-D Batch 1).
// Source of truth: The GO TO document v81.2 (10-Jul-2026),
// chapter 69 "Government Deals", pages 322-324. Verified rules:
//   - New deal bookings/ticketing are issued ONLY through flydubai retail
//     offices in the UAE; no other office, including DXB APT, can issue them.
//     Contact Centre cannot create a Government Deal booking (pp.322-324).
//   - Adding an adult/child: refer to the travel shop for the discount, or after
//     consulting FS/SUP create a separate non-discounted booking (a standalone
//     child booking has no OLCI/online modification) (p.322).
//   - The agent may assist in adding an infant to a deal booking (p.322).
//   - Modification/cancellation may be done through Contact Centre or retail
//     shops; multi-city modifications go through the ticket issuer; refunds may
//     be voucher-only (pp.322-323).
//   - Not applicable to interline/codeshare bookings (p.322).

import { QUESTION_SETS } from "../questions.ts";
import type { DecisionDefinition } from "../evaluator.ts";

export const GOVERNMENT_DEALS_DEFINITION: DecisionDefinition = {
  procedureSlug: "government-deals",
  procedureTitle: "Government Deals",
  version: 1,
  sourceVersion: "81.2 (10-Jul-2026)",
  sourceChapter: "69. Government Deals",
  sourcePages: [322, 323, 324],
  questions: QUESTION_SETS["government-deals"],
  rules: [
    {
      id: "gov-interline",
      conditions: [{ questionId: "interline_codeshare", equals: true }],
      outcome: "Not permitted",
      explanation: "Government Deals are not applicable to interline or codeshare bookings.",
      nextAction: "Do not process the request under the Government Deals procedure.",
      sourcePages: [322],
      sourceField: "Government Deals exclusions",
    },
    {
      id: "gov-create",
      conditions: [
        { questionId: "request_type", equals: "Create a new discounted booking" },
        { questionId: "interline_codeshare", equals: false },
      ],
      outcome: "Not permitted",
      explanation:
        "New Government Deal bookings and ticket issuance are handled only through eligible flydubai retail offices in the UAE.",
      nextAction:
        "Refer the passenger to an eligible flydubai Travel Shop. Do not issue the deal through Contact Centre or the DXB Airport office.",
      sourcePages: [322, 323, 324],
      sourceField: "Government Deal creation and issuing channels",
    },
    {
      id: "gov-add-adult-child",
      conditions: [
        { questionId: "request_type", equals: "Add an adult or child" },
        { questionId: "interline_codeshare", equals: false },
      ],
      outcome: "Requires supervisor",
      explanation:
        "Adding an adult or child to an existing Government Deal requires Travel Shop handling or a separately priced booking after Floor Support/Supervisor consultation.",
      nextAction:
        "Refer to the Travel Shop for the discounted option, or consult FS/SUP before creating a separate non-discounted booking. A standalone child booking may not support OLCI or online modification.",
      sourcePages: [322],
      sourceField: "Adding adult/child to Government Deal",
    },
    {
      id: "gov-add-infant",
      conditions: [
        { questionId: "request_type", equals: "Add an infant" },
        { questionId: "interline_codeshare", equals: false },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Contact Centre may assist with adding an infant to an existing Government Deal booking under the documented process.",
      nextAction: "Follow the existing infant-addition process and verify the booking remains eligible.",
      sourcePages: [322],
      sourceField: "Infant addition",
    },
    {
      id: "gov-modify-cancel",
      conditions: [
        { questionId: "request_type", equals: "Modify or cancel an existing deal booking" },
        { questionId: "interline_codeshare", equals: false },
      ],
      outcome: "Can proceed with conditions",
      explanation:
        "Government Deal bookings may be modified or cancelled through Contact Centre or eligible retail shops, subject to the deal fare rules.",
      nextAction:
        "Apply the documented fare rules. Multi-city modifications must be handled by the ticket issuer. Refunds may be voucher-only where specified.",
      sourcePages: [322, 323],
      sourceField: "Modification, cancellation and refund handling",
    },
  ],
  notes: [
    "Contact Centre cannot create or issue a new Government Deal booking; those are handled only at eligible flydubai retail offices in the UAE.",
    "Deals apply to return tickets originating from Dubai; discounts do not apply on promotion or sale fares.",
    "A standalone child booking created without the deal is not entitled to OLCI or online modification.",
  ],
};
