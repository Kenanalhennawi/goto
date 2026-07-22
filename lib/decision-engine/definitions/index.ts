// Central decision-definition registry (Phase D).
// Every definition here is deterministic and grounded in verified GO TO
// source pages; no outcome exists without an explicit, source-cited rule.

import type { DecisionDefinition } from "../evaluator.ts";
import { PREGNANCY_DEFINITION } from "./pregnancy.ts";
import { SPORTING_EQUIPMENT_DEFINITION } from "./sporting-equipment.ts";
import { CHECK_IN_OLCI_DEFINITION } from "./check-in-olci.ts";
import { FLIGHT_DISRUPTION_DEFINITION } from "./flight-disruption.ts";
import { EXTRA_SEAT_CBBG_DEFINITION } from "./extra-seat-cbbg.ts";
import { MINIMUM_CONNECTION_TIME_DEFINITION } from "./minimum-connection-time.ts";
import { WHEELCHAIR_DEFINITION } from "./wheelchair.ts";
import { NAME_CORRECTION_DEFINITION } from "./name-correction.ts";
import { FALCON_HANDLING_DEFINITION } from "./falcon-handling.ts";
import { DUPLICATE_BOOKING_DEFINITION } from "./duplicate-booking.ts";
import { GOVERNMENT_DEALS_DEFINITION } from "./government-deals.ts";
import { AUTO_SPLIT_OD_DEFINITION } from "./auto-split-od.ts";
import { TRAVEL_REQUIREMENTS_DEFINITION } from "./travel-requirements.ts";
import { OK_TO_BOARD_DEFINITION } from "./ok-to-board.ts";
import { VISA_CHANGE_DEFINITION } from "./visa-change.ts";
import { MEET_ASSIST_DEFINITION } from "./meet-assist.ts";
import { BUSINESS_LOUNGE_DEFINITION } from "./business-lounge.ts";
import { BLUE_RIBBON_BAGS_DEFINITION } from "./blue-ribbon-bags.ts";
import { WORLDTRACER_DEFINITION } from "./worldtracer.ts";

export const DECISION_DEFINITIONS: Record<string, DecisionDefinition> = {
  pregnancy: PREGNANCY_DEFINITION,
  "sporting-equipment": SPORTING_EQUIPMENT_DEFINITION,
  "check-in-olci": CHECK_IN_OLCI_DEFINITION,
  "flight-disruption": FLIGHT_DISRUPTION_DEFINITION,
  "extra-seat-cbbg": EXTRA_SEAT_CBBG_DEFINITION,
  "minimum-connection-time": MINIMUM_CONNECTION_TIME_DEFINITION,
  wheelchair: WHEELCHAIR_DEFINITION,
  "name-correction": NAME_CORRECTION_DEFINITION,
  "falcon-handling": FALCON_HANDLING_DEFINITION,
  "duplicate-booking": DUPLICATE_BOOKING_DEFINITION,
  "government-deals": GOVERNMENT_DEALS_DEFINITION,
  "auto-split-od": AUTO_SPLIT_OD_DEFINITION,
  "travel-requirements": TRAVEL_REQUIREMENTS_DEFINITION,
  "ok-to-board": OK_TO_BOARD_DEFINITION,
  "visa-change": VISA_CHANGE_DEFINITION,
  "meet-assist": MEET_ASSIST_DEFINITION,
  "business-lounge": BUSINESS_LOUNGE_DEFINITION,
  "blue-ribbon-bags": BLUE_RIBBON_BAGS_DEFINITION,
  worldtracer: WORLDTRACER_DEFINITION,
};

/**
 * Source-freshness guard: the published card's source version must match the
 * version the definition was verified against (numeric part, e.g. "81.2").
 * A stale or missing card version disables the guided workflow.
 */
export function sourceVersionMatches(
  cardSourceVersion: string | null | undefined,
  definitionSourceVersion: string
): boolean {
  const card = extractVersion(cardSourceVersion ?? "");
  const definition = extractVersion(definitionSourceVersion);
  return card !== null && definition !== null && card === definition;
}

function extractVersion(value: string): string | null {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? match[0] : null;
}
