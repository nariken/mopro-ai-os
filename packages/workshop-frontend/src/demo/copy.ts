/** Screen copy constants — tests assert against MOP-595 literals, not these aliases. */

export const COPY = {
  demoLabel: 'Synthetic demo',
  demoLabelInternal: 'Synthetic demo · Internal only',
  demoLabelPrivacy: 'Synthetic demo · Privacy-safe preview',
  demoLabelNoSend: 'Synthetic demo · No request will be sent',

  wish: {
    h1: 'Find a Japanese vintage lens you can trust.',
    supporting:
      'Tell us the exact lens and the condition you can accept. This demo structures your wish locally and uses no real buyer or supplier data.',
    primary: 'Structure my demo wish',
    secondary: 'Reset demo',
    resetConfirm: 'Reset all demo fields?',
    budgetHelper: 'Demo budget only—this is not a quote or payment commitment.',
    consent:
      'I understand this is a synthetic demo and nothing will be sent, published, purchased, or shipped.',
    loading: 'Structuring your demo wish locally…',
    structuringError: 'We couldn’t structure this demo wish. Your entries are still here.',
    tryAgain: 'Try again',
    editFields: 'Edit fields',
  },

  confirm: {
    h1: 'Confirm your structured wish',
    supporting:
      'Review every detail. Unknown values stay unknown and must be confirmed before this wish can proceed.',
    primary: 'Confirm demo wish',
    secondary: 'Edit wish',
    discard: 'Discard demo wish',
    success: 'Demo wish confirmed',
    unknownHint: 'Confirm this value to continue',
    serialUnknown: 'No specific serial number requested.',
    humanGate:
      'Human Gate: A real wish would require approved consent, privacy review, and external-send approval. This demo performs none of those actions.',
    sections: {
      item: 'Item & compatibility',
      condition: 'Condition tolerance',
      quantity: 'Quantity & budget',
      timing: 'Timing & destination',
      note: 'Your original note',
    },
  },

  match: {
    h1: 'Founder demo offer matched',
    supplierName: 'Founder Demo Supplier',
    supplierStatus: 'Synthetic internal supplier',
    supplierCopy: 'No identity proof, inventory, sourcing, or supplier contact exists.',
    requestedOutcome:
      'Locate one Canon FD 50mm f/1.4 S.S.C. matching the confirmed tolerances',
    itemCost: 'Unknown',
    supplierReward: 'Unknown',
    shipping: 'Unknown',
    total: 'Not quoted',
    availability: 'Not verified',
    validity: 'Demo only—no commercial validity',
    matchStatus: 'Internal demo match confirmed',
    matchCopy:
      'This confirms only that the synthetic wish and synthetic offer are structurally compatible. It is not a reservation, transaction, compliance decision, purchase, or shipment.',
    primary: 'View privacy-safe board card',
    secondary: 'Back to confirmed wish',
    offerEmpty: 'No synthetic offer yet.',
    createOffer: 'Create founder demo offer',
    matchError: 'The demo offer does not match the confirmed wish.',
    returnToWish: 'Return to wish',
    humanGate:
      'Human Gate: Real supplier routing, offer approval, compliance review, pricing, buyer confirmation, payment, and shipping require separate named-human approval.',
  },

  board: {
    h1: 'Wanted in Japan',
    footer: 'Synthetic demo · No real buyer, supplier, listing, or inventory.',
    primary: 'Start over',
    secondary: 'View internal match',
    empty: 'No confirmed synthetic wishes to show.',
    createWish: 'Create a demo wish',
  },

  tags: {
    confirmed: 'Confirmed',
    needsConfirmation: 'Needs confirmation',
    unknown: 'Unknown',
  },
} as const
