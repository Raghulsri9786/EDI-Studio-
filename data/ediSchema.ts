
import { SegmentSchema } from '../types';

/**
 * X12 & EDIFACT Segment Definitions
 * Comprehensive schema based on X12.NET and EdiFabric examples.
 * Includes Supply Chain, HIPAA, Transportation, and Global Standards.
 */
export const STANDARD_SEGMENTS: Record<string, SegmentSchema> = {
  // --- X12 ENVELOPES ---
  ISA: {
    id: 'ISA',
    name: 'Interchange Control Header',
    purpose: 'Starts and identifies an interchange of zero or more functional groups and interchange-related control segments.',
    elements: [
      { index: 1, id: 'ISA01', name: 'Authorization Info Qualifier', type: 'ID', min: 2, max: 2, qualifiers: { '00': 'No Authorization Info', '03': 'Additional Data ID' } },
      { index: 2, id: 'ISA02', name: 'Authorization Information', type: 'AN', min: 10, max: 10 },
      { index: 3, id: 'ISA03', name: 'Security Info Qualifier', type: 'ID', min: 2, max: 2, qualifiers: { '00': 'No Security Info', '01': 'Password' } },
      { index: 4, id: 'ISA04', name: 'Security Information', type: 'AN', min: 10, max: 10 },
      { index: 5, id: 'ISA05', name: 'Interchange ID Qualifier', type: 'ID', min: 2, max: 2, qualifiers: { 'ZZ': 'Mutually Defined', '01': 'DUNS', '08': 'UCC EDI', '12': 'Phone', '14': 'DUNS+Suffix' } },
      { index: 6, id: 'ISA06', name: 'Interchange Sender ID', type: 'AN', min: 15, max: 15 },
      { index: 7, id: 'ISA07', name: 'Interchange ID Qualifier', type: 'ID', min: 2, max: 2, qualifiers: { 'ZZ': 'Mutually Defined', '01': 'DUNS', '08': 'UCC EDI' } },
      { index: 8, id: 'ISA08', name: 'Interchange Receiver ID', type: 'AN', min: 15, max: 15 },
      { index: 9, id: 'ISA09', name: 'Interchange Date', type: 'DT', min: 6, max: 6 },
      { index: 10, id: 'ISA10', name: 'Interchange Time', type: 'TM', min: 4, max: 4 },
      { index: 11, id: 'ISA11', name: 'Repetition Separator', type: 'ID', min: 1, max: 1 },
      { index: 12, id: 'ISA12', name: 'Interchange Control Version', type: 'ID', min: 5, max: 5 },
      { index: 13, id: 'ISA13', name: 'Interchange Control Number', type: 'N0', min: 9, max: 9 },
      { index: 14, id: 'ISA14', name: 'Acknowledgment Requested', type: 'ID', min: 1, max: 1, qualifiers: { '0': 'No Ack', '1': 'Ack Requested' } },
      { index: 15, id: 'ISA15', name: 'Usage Indicator', type: 'ID', min: 1, max: 1, qualifiers: { 'P': 'Production', 'T': 'Test', 'I': 'Information' } },
      { index: 16, id: 'ISA16', name: 'Component Element Separator', type: 'ID', min: 1, max: 1 },
    ],
  },
  GS: {
    id: 'GS',
    name: 'Functional Group Header',
    purpose: 'Indicates the beginning of a functional group and provides control information.',
    elements: [
      { index: 1, id: 'GS01', name: 'Functional Identifier Code', type: 'ID', min: 2, max: 2, qualifiers: { 'PO': 'Purchase Order (850)', 'IN': 'Invoice (810)', 'SH': 'Ship Notice (856)', 'FA': 'Functional Ack (997)', 'IB': 'Inventory Inquiry (846)', 'OW': 'Warehouse Order (940)', 'SW': 'Warehouse Advice (945)', 'QM': 'Transportation Status (214)', 'HC': 'Health Care Claim (837)', 'BE': 'Benefit Enrollment (834)', 'HP': 'Payment/Advice (835)', 'DX': 'Direct Exchange (894)', 'PS': 'Planning Schedule (830)', 'PC': 'Purchase Order Change (860)', 'RA': 'Payment Order/Remittance Advice (820)', 'TM': 'Motor Carrier Tender (204)', 'SM': 'Motor Carrier Shipping Manifest (215)' } },
      { index: 2, id: 'GS02', name: 'Application Sender Code', type: 'AN', min: 2, max: 15 },
      { index: 3, id: 'GS03', name: 'Application Receiver Code', type: 'AN', min: 2, max: 15 },
      { index: 4, id: 'GS04', name: 'Date', type: 'DT', min: 8, max: 8 },
      { index: 5, id: 'GS05', name: 'Time', type: 'TM', min: 4, max: 8 },
      { index: 6, id: 'GS06', name: 'Group Control Number', type: 'N0', min: 1, max: 9 },
      { index: 7, id: 'GS07', name: 'Responsible Agency Code', type: 'ID', min: 1, max: 2, qualifiers: { 'X': 'X12', 'T': 'TCS' } },
      { index: 8, id: 'GS08', name: 'Version / Release / Industry ID', type: 'AN', min: 1, max: 12 },
    ],
  },
  ST: {
    id: 'ST',
    name: 'Transaction Set Header',
    purpose: 'Indicates the start of a transaction set and assigns a control number.',
    elements: [
      { index: 1, id: 'ST01', name: 'Transaction Set Identifier', type: 'ID', min: 3, max: 3 },
      { index: 2, id: 'ST02', name: 'Transaction Set Control Number', type: 'AN', min: 4, max: 9 },
    ],
  },
  SE: {
    id: 'SE',
    name: 'Transaction Set Trailer',
    purpose: 'To indicate the end of the transaction set and provide the count of the transmitted segments.',
    elements: [
      { index: 1, id: 'SE01', name: 'Number of Included Segments', type: 'N0', min: 1, max: 10 },
      { index: 2, id: 'SE02', name: 'Transaction Set Control Number', type: 'AN', min: 4, max: 9 },
    ],
  },
  GE: {
    id: 'GE',
    name: 'Functional Group Trailer',
    purpose: 'To indicate the end of a functional group and provide control information.',
    elements: [
      { index: 1, id: 'GE01', name: 'Number of Transaction Sets', type: 'N0', min: 1, max: 6 },
      { index: 2, id: 'GE02', name: 'Group Control Number', type: 'N0', min: 1, max: 9 },
    ],
  },
  IEA: {
    id: 'IEA',
    name: 'Interchange Control Trailer',
    purpose: 'To define the end of an interchange of one or more functional groups.',
    elements: [
      { index: 1, id: 'IEA01', name: 'Number of Included Groups', type: 'N0', min: 1, max: 5 },
      { index: 2, id: 'IEA02', name: 'Interchange Control Number', type: 'N0', min: 9, max: 9 },
    ],
  },

  // --- GENERAL / COMMON ---
  REF: {
    id: 'REF',
    name: 'Reference Identification',
    purpose: 'To specify identifying information.',
    elements: [
      { index: 1, id: 'REF01', name: 'Reference Identification Qualifier', type: 'ID', min: 2, max: 3 },
      { index: 2, id: 'REF02', name: 'Reference Identification', type: 'AN', min: 1, max: 50 },
      { index: 3, id: 'REF03', name: 'Description', type: 'AN', min: 1, max: 80 }
    ]
  },
  DTM: {
    id: 'DTM',
    name: 'Date/Time Reference',
    purpose: 'To specify pertinent dates and times.',
    elements: [
      { index: 1, id: 'DTM01', name: 'Date/Time Qualifier', type: 'ID', min: 3, max: 3 },
      { index: 2, id: 'DTM02', name: 'Date', type: 'DT', min: 8, max: 8 },
      { index: 3, id: 'DTM03', name: 'Time', type: 'TM', min: 4, max: 8 },
      { index: 4, id: 'DTM04', name: 'Time Code', type: 'ID', min: 2, max: 2 }
    ]
  },
  PER: {
    id: 'PER',
    name: 'Administrative Communications Contact',
    purpose: 'To identify a person or office to whom administrative communications should be directed.',
    elements: [
      { index: 1, id: 'PER01', name: 'Contact Function Code', type: 'ID', min: 2, max: 2 },
      { index: 2, id: 'PER02', name: 'Name', type: 'AN', min: 1, max: 60 },
      { index: 3, id: 'PER03', name: 'Communication Number Qualifier', type: 'ID', min: 2, max: 2 },
      { index: 4, id: 'PER04', name: 'Communication Number', type: 'AN', min: 1, max: 256 }
    ]
  },
  MEA: {
    id: 'MEA',
    name: 'Measurements',
    purpose: 'To specify physical measurements or counts, including dimensions, tolerances, variances, and weights.',
    elements: [
      { index: 1, id: 'MEA01', name: 'Measurement Reference ID Code', type: 'ID', min: 2, max: 2 },
      { index: 2, id: 'MEA02', name: 'Measurement Qualifier', type: 'ID', min: 1, max: 3 },
      { index: 3, id: 'MEA03', name: 'Measurement Value', type: 'R', min: 1, max: 20 },
      { index: 4, id: 'MEA04', name: 'Composite Unit of Measure', type: 'AN', min: 1, max: 15 } 
    ]
  },
  FOB: {
    id: 'FOB',
    name: 'F.O.B. Related Instructions',
    purpose: 'To specify transportation instructions relating to shipment.',
    elements: [
      { index: 1, id: 'FOB01', name: 'Shipment Method of Payment', type: 'ID', min: 2, max: 2 },
      { index: 2, id: 'FOB02', name: 'Location Qualifier', type: 'ID', min: 1, max: 2 },
      { index: 3, id: 'FOB03', name: 'Description', type: 'AN', min: 1, max: 80 }
    ]
  },
  PID: {
    id: 'PID',
    name: 'Product/Item Description',
    purpose: 'To describe a product or process in coded or free-form format.',
    elements: [
      { index: 1, id: 'PID01', name: 'Item Description Type', type: 'ID', min: 1, max: 1 },
      { index: 2, id: 'PID02', name: 'Product/Process Characteristic Code', type: 'ID', min: 2, max: 3 },
      { index: 5, id: 'PID05', name: 'Description', type: 'AN', min: 1, max: 80 }
    ]
  },
  SAC: {
    id: 'SAC',
    name: 'Service, Promotion, Allowance, or Charge Information',
    purpose: 'To request or identify a service, promotion, allowance, or charge; to specify the amount or percentage for the service, promotion, allowance, or charge.',
    elements: [
      { index: 1, id: 'SAC01', name: 'Allowance or Charge Indicator', type: 'ID', min: 1, max: 1 },
      { index: 2, id: 'SAC02', name: 'Service, Promotion, Allowance, or Charge Code', type: 'ID', min: 4, max: 4 },
      { index: 5, id: 'SAC05', name: 'Amount', type: 'N2', min: 1, max: 15 }
    ]
  },
  CUR: {
    id: 'CUR',
    name: 'Currency',
    purpose: 'To specify the currency (dollars, pounds, francs, etc.) used in a transaction.',
    elements: [
        { index: 1, id: 'CUR01', name: 'Entity Identifier Code', type: 'ID', min: 2, max: 3 },
        { index: 2, id: 'CUR02', name: 'Currency Code', type: 'ID', min: 3, max: 3 }
    ]
  },
  ITD: {
    id: 'ITD',
    name: 'Terms of Sale/Deferred Terms of Sale',
    purpose: 'To specify terms of sale.',
    elements: [
      { index: 1, id: 'ITD01', name: 'Terms Type Code', type: 'ID', min: 2, max: 2 },
      { index: 2, id: 'ITD02', name: 'Terms Basis Date Code', type: 'ID', min: 1, max: 2 },
      { index: 3, id: 'ITD03', name: 'Terms Discount Percent', type: 'R', min: 1, max: 6 },
      { index: 5, id: 'ITD05', name: 'Terms Discount Days Due', type: 'N0', min: 1, max: 3 },
      { index: 7, id: 'ITD07', name: 'Terms Net Days', type: 'N0', min: 1, max: 3 }
    ]
  },
  QTY: {
    id: 'QTY',
    name: 'Quantity',
    purpose: 'To specify quantity information.',
    elements: [
        { index: 1, id: 'QTY01', name: 'Quantity Qualifier', type: 'ID', min: 2, max: 2 },
        { index: 2, id: 'QTY02', name: 'Quantity', type: 'R', min: 1, max: 15 },
        { index: 3, id: 'QTY03', name: 'Unit or Basis for Measurement Code', type: 'ID', min: 2, max: 2 }
    ]
  },
  AMT: {
    id: 'AMT',
    name: 'Monetary Amount',
    purpose: 'To indicate the total monetary amount.',
    elements: [
        { index: 1, id: 'AMT01', name: 'Amount Qualifier Code', type: 'ID', min: 1, max: 3 },
        { index: 2, id: 'AMT02', name: 'Monetary Amount', type: 'R', min: 1, max: 18 }
    ]
  },
  N1: {
    id: 'N1',
    name: 'Name',
    purpose: 'To identify a party by type of organization, name, and code.',
    elements: [
      { index: 1, id: 'N101', name: 'Entity Identifier Code', type: 'ID', min: 2, max: 3 },
      { index: 2, id: 'N102', name: 'Name', type: 'AN', min: 1, max: 60 },
      { index: 3, id: 'N103', name: 'ID Code Qualifier', type: 'ID', min: 1, max: 2 },
      { index: 4, id: 'N104', name: 'Identification Code', type: 'AN', min: 2, max: 80 },
    ],
  },
  N2: {
    id: 'N2',
    name: 'Additional Name Information',
    purpose: 'To specify additional names or those longer than 35 characters in length.',
    elements: [
      { index: 1, id: 'N201', name: 'Name', type: 'AN', min: 1, max: 60 },
      { index: 2, id: 'N202', name: 'Name', type: 'AN', min: 1, max: 60 }
    ]
  },
  N3: {
    id: 'N3',
    name: 'Address Information',
    purpose: 'To specify the location of the named party.',
    elements: [
      { index: 1, id: 'N301', name: 'Address Information', type: 'AN', min: 1, max: 55 },
      { index: 2, id: 'N302', name: 'Address Information', type: 'AN', min: 1, max: 55 }
    ]
  },
  N4: {
    id: 'N4',
    name: 'Geographic Location',
    purpose: 'To specify the geographic place of the named party.',
    elements: [
      { index: 1, id: 'N401', name: 'City Name', type: 'AN', min: 2, max: 30 },
      { index: 2, id: 'N402', name: 'State or Province Code', type: 'ID', min: 2, max: 2 },
      { index: 3, id: 'N403', name: 'Postal Code', type: 'ID', min: 3, max: 15 },
      { index: 4, id: 'N404', name: 'Country Code', type: 'ID', min: 2, max: 3 }
    ]
  },
  MSG: {
    id: 'MSG',
    name: 'Message Text',
    purpose: 'To provide a free-form format that allows the transmission of text information.',
    elements: [
        { index: 1, id: 'MSG01', name: 'Free-Form Message Text', type: 'AN', min: 1, max: 264 }
    ]
  },

  // --- TRANSPORTATION SPECIFIC ---
  N9: {
    id: 'N9',
    name: 'Reference Identification',
    purpose: 'To transmit identifying information as specified by the Reference Identification Qualifier.',
    elements: [
        { index: 1, id: 'N901', name: 'Reference Identification Qualifier', type: 'ID', min: 2, max: 3 },
        { index: 2, id: 'N902', name: 'Reference Identification', type: 'AN', min: 1, max: 50 }
    ]
  },
  L11: {
    id: 'L11',
    name: 'Business Instructions',
    purpose: 'To specify instructions in this business relationship.',
    elements: [
        { index: 1, id: 'L1101', name: 'Reference Identification', type: 'AN', min: 1, max: 50 },
        { index: 2, id: 'L1102', name: 'Reference Identification Qualifier', type: 'ID', min: 2, max: 3 }
    ]
  },
  AT7: {
    id: 'AT7',
    name: 'Shipment Status Details',
    purpose: 'To specify the status of a shipment, the reason for that status, the date and time of the status, and the date and time of any appointments scheduled.',
    elements: [
        { index: 1, id: 'AT701', name: 'Shipment Status Code', type: 'ID', min: 2, max: 2 },
        { index: 2, id: 'AT702', name: 'Shipment Status or Appointment Reason Code', type: 'ID', min: 2, max: 2 },
        { index: 3, id: 'AT703', name: 'Appointment Status Code', type: 'ID', min: 2, max: 2 },
        { index: 4, id: 'AT704', name: 'Appointment Reason Code', type: 'ID', min: 2, max: 2 },
        { index: 5, id: 'AT705', name: 'Date', type: 'DT', min: 8, max: 8 },
        { index: 6, id: 'AT706', name: 'Time', type: 'TM', min: 4, max: 8 }
    ]
  },
  MS1: {
    id: 'MS1',
    name: 'Equipment, Shipment, or Real Property Location',
    purpose: 'To specify the location of a piece of equipment, a shipment, or real property.',
    elements: [
        { index: 1, id: 'MS101', name: 'City Name', type: 'AN', min: 2, max: 30 },
        { index: 2, id: 'MS102', name: 'State or Province Code', type: 'ID', min: 2, max: 2 },
        { index: 3, id: 'MS103', name: 'Country Code', type: 'ID', min: 2, max: 3 }
    ]
  },
  MS2: {
    id: 'MS2',
    name: 'Equipment or Container Owner and Type',
    purpose: 'To specify the owner, the identification number assigned by that owner, and the type of equipment.',
    elements: [
        { index: 1, id: 'MS201', name: 'Standard Carrier Alpha Code', type: 'ID', min: 2, max: 4 },
        { index: 2, id: 'MS202', name: 'Equipment Number', type: 'AN', min: 1, max: 10 }
    ]
  },
  MS3: {
    id: 'MS3',
    name: 'Interline Information',
    purpose: 'To identify the interline carrier and relevant data.',
    elements: [
        { index: 1, id: 'MS301', name: 'Standard Carrier Alpha Code', type: 'ID', min: 2, max: 4 },
        { index: 2, id: 'MS302', name: 'Routing Sequence Code', type: 'ID', min: 1, max: 2 }
    ]
  },
  B2: {
    id: 'B2',
    name: 'Beginning Segment for Shipment Information',
    purpose: 'To transmit basic data relating to shipment information.',
    elements: [
      { index: 2, id: 'B202', name: 'Standard Carrier Alpha Code', type: 'ID', min: 2, max: 4 },
      { index: 4, id: 'B204', name: 'Shipment Identification Number', type: 'AN', min: 1, max: 30 }
    ]
  },
  B2A: {
    id: 'B2A',
    name: 'Set Purpose',
    purpose: 'To allow for positive identification of transaction set purpose.',
    elements: [
      { index: 1, id: 'B2A01', name: 'Transaction Set Purpose Code', type: 'ID', min: 2, max: 2 }
    ]
  },
  L3: {
    id: 'L3',
    name: 'Total Weight and Charges',
    purpose: 'To specify the total shipment in terms of weight, volume, rates, charges, advances, and prepaid amounts applicable to one or more line items.',
    elements: [
      { index: 1, id: 'L301', name: 'Weight', type: 'R', min: 1, max: 10 },
      { index: 2, id: 'L302', name: 'Weight Qualifier', type: 'ID', min: 1, max: 2 },
      { index: 5, id: 'L305', name: 'Charge', type: 'N2', min: 1, max: 12 },
      { index: 11, id: 'L311', name: 'Quantity', type: 'N0', min: 1, max: 7 }
    ]
  },
  LX: {
    id: 'LX',
    name: 'Assigned Number',
    purpose: 'To reference a line number in a transaction set.',
    elements: [
      { index: 1, id: 'LX01', name: 'Assigned Number', type: 'N0', min: 1, max: 6 }
    ]
  },
  S5: {
    id: 'S5',
    name: 'Stop Off Details',
    purpose: 'To specify stop-off detail reference numbers and stop reason.',
    elements: [
      { index: 1, id: 'S501', name: 'Stop Sequence Number', type: 'N0', min: 1, max: 3 },
      { index: 2, id: 'S502', name: 'Stop Reason Code', type: 'ID', min: 2, max: 2 }
    ]
  },
  G62: {
    id: 'G62',
    name: 'Date/Time',
    purpose: 'To specify pertinent dates and times.',
    elements: [
      { index: 1, id: 'G6201', name: 'Date Qualifier', type: 'ID', min: 2, max: 2 },
      { index: 2, id: 'G6202', name: 'Date', type: 'DT', min: 8, max: 8 },
      { index: 3, id: 'G6203', name: 'Time Qualifier', type: 'ID', min: 1, max: 2 },
      { index: 4, id: 'G6204', name: 'Time', type: 'TM', min: 4, max: 8 }
    ]
  },
  N7: {
    id: 'N7',
    name: 'Equipment Details',
    purpose: 'To identify the equipment.',
    elements: [
      { index: 1, id: 'N701', name: 'Equipment Initial', type: 'AN', min: 1, max: 4 },
      { index: 2, id: 'N702', name: 'Equipment Number', type: 'AN', min: 1, max: 10 },
      { index: 11, id: 'N711', name: 'Equipment Description Code', type: 'ID', min: 2, max: 2 }
    ]
  },
  TD1: {
    id: 'TD1',
    name: 'Carrier Details (Quantity and Weight)',
    purpose: 'To specify the transportation details relative to commodity, weight, and quantity.',
    elements: [
      { index: 1, id: 'TD101', name: 'Packaging Code', type: 'AN', min: 3, max: 5 },
      { index: 2, id: 'TD102', name: 'Lading Quantity', type: 'N0', min: 1, max: 7 }
    ]
  },
  TD5: {
    id: 'TD5',
    name: 'Carrier Details (Routing Sequence/Transit Time)',
    purpose: 'To specify the carrier and sequence of routing and provide transit time information.',
    elements: [
      { index: 1, id: 'TD501', name: 'Routing Sequence Code', type: 'ID', min: 1, max: 2 },
      { index: 2, id: 'TD502', name: 'Identification Code Qualifier', type: 'ID', min: 1, max: 2 },
      { index: 3, id: 'TD503', name: 'Identification Code', type: 'AN', min: 2, max: 80 },
      { index: 4, id: 'TD504', name: 'Transportation Method/Type Code', type: 'ID', min: 1, max: 2 }
    ]
  },
  W12: {
    id: 'W12',
    name: 'Warehouse Item Detail',
    purpose: 'To designate those line items that were shipped.',
    elements: [
      { index: 1, id: 'W1201', name: 'Shipment Order Status Code', type: 'ID', min: 2, max: 2 },
      { index: 2, id: 'W1202', name: 'Quantity Ordered', type: 'R', min: 1, max: 15 },
      { index: 3, id: 'W1203', name: 'Number of Units Shipped', type: 'R', min: 1, max: 15 },
      { index: 7, id: 'W1207', name: 'Product/Service ID Qualifier', type: 'ID', min: 2, max: 2 },
      { index: 8, id: 'W1208', name: 'Product/Service ID', type: 'AN', min: 1, max: 48 }
    ]
  },

  // --- INVOICE SPECIFIC (810) ---
  BIG: {
    id: 'BIG',
    name: 'Beginning Segment for Invoice',
    purpose: 'To indicate the beginning of an Invoice Transaction Set and transmit identifying numbers and dates.',
    elements: [
      { index: 1, id: 'BIG01', name: 'Date', type: 'DT', min: 8, max: 8 },
      { index: 2, id: 'BIG02', name: 'Invoice Number', type: 'AN', min: 1, max: 22 },
      { index: 3, id: 'BIG03', name: 'Date', type: 'DT', min: 8, max: 8 },
      { index: 4, id: 'BIG04', name: 'Purchase Order Number', type: 'AN', min: 1, max: 22 }
    ]
  },
  IT1: {
    id: 'IT1',
    name: 'Baseline Item Data (Invoice)',
    purpose: 'To specify the basic and most frequently used line item data for the invoice and related transactions.',
    elements: [
      { index: 1, id: 'IT101', name: 'Assigned Identification', type: 'AN', min: 1, max: 20 },
      { index: 2, id: 'IT102', name: 'Quantity Invoiced', type: 'R', min: 1, max: 10 },
      { index: 3, id: 'IT103', name: 'Unit or Basis for Measurement Code', type: 'ID', min: 2, max: 2 },
      { index: 4, id: 'IT104', name: 'Unit Price', type: 'R', min: 1, max: 17 }
    ]
  },
  TDS: {
    id: 'TDS',
    name: 'Total Monetary Value Summary',
    purpose: 'To specify the total invoice discounts and amounts.',
    elements: [
      { index: 1, id: 'TDS01', name: 'Total Invoice Amount', type: 'N2', min: 1, max: 15 }
    ]
  },
  CTT: {
    id: 'CTT',
    name: 'Transaction Totals',
    purpose: 'To transmit a hash total for a specific element in the transaction set.',
    elements: [
      { index: 1, id: 'CTT01', name: 'Number of Line Items', type: 'N0', min: 1, max: 6 },
      { index: 2, id: 'CTT02', name: 'Hash Total', type: 'R', min: 1, max: 10 }
    ]
  },

  // --- FINANCE / REMITTANCE (820, 835) ---
  BPR: {
    id: 'BPR',
    name: 'Beginning Segment for Payment Order/Remittance Advice',
    purpose: 'To indicate the beginning of a Payment Order/Remittance Advice Transaction Set.',
    elements: [
      { index: 1, id: 'BPR01', name: 'Transaction Handling Code', type: 'ID', min: 1, max: 1 },
      { index: 2, id: 'BPR02', name: 'Monetary Amount', type: 'R', min: 1, max: 18 },
      { index: 3, id: 'BPR03', name: 'Credit/Debit Flag Code', type: 'ID', min: 1, max: 1 },
      { index: 4, id: 'BPR04', name: 'Payment Method Code', type: 'ID', min: 3, max: 3 }
    ]
  },
  TRN: {
    id: 'TRN',
    name: 'Trace',
    purpose: 'To uniquely identify a transaction to an application.',
    elements: [
      { index: 1, id: 'TRN01', name: 'Trace Type Code', type: 'ID', min: 1, max: 2 },
      { index: 2, id: 'TRN02', name: 'Reference Identification', type: 'AN', min: 1, max: 30 }
    ]
  },
  RMR: {
    id: 'RMR',
    name: 'Remittance Advice Accounts Receivable Open Item Reference',
    purpose: 'To specify the accounts receivable open item(s) to be included in the cash application.',
    elements: [
      { index: 1, id: 'RMR01', name: 'Reference Identification Qualifier', type: 'ID', min: 2, max: 3 },
      { index: 2, id: 'RMR02', name: 'Reference Identification', type: 'AN', min: 1, max: 50 },
      { index: 4, id: 'RMR04', name: 'Monetary Amount', type: 'R', min: 1, max: 18 }
    ]
  },

  // --- PLANNING & MAINTENANCE ---
  SN1: {
    id: 'SN1',
    name: 'Item Detail (Shipment)',
    purpose: 'To specify line-item detail relative to shipment.',
    elements: [
      { index: 1, id: 'SN101', name: 'Assigned Identification', type: 'AN', min: 1, max: 20 },
      { index: 2, id: 'SN102', name: 'Number of Units Shipped', type: 'R', min: 1, max: 15 },
      { index: 3, id: 'SN103', name: 'Unit or Basis for Measurement Code', type: 'ID', min: 2, max: 2 }
    ]
  },
  UIT: {
    id: 'UIT',
    name: 'Unit Detail',
    purpose: 'To specify item unit data.',
    elements: [
      { index: 1, id: 'UIT01', name: 'Composite Unit of Measure', type: 'AN', min: 1, max: 15 }
    ]
  },
  MAN: {
    id: 'MAN',
    name: 'Marks and Numbers',
    purpose: 'To indicate identifying marks and numbers for shipping containers.',
    elements: [
        { index: 1, id: 'MAN01', name: 'Marks and Numbers Qualifier', type: 'ID', min: 1, max: 2 },
        { index: 2, id: 'MAN02', name: 'Marks and Numbers', type: 'AN', min: 1, max: 48 }
    ]
  },
  AK1: {
    id: 'AK1',
    name: 'Functional Group Response Header',
    purpose: 'To start acknowledgment of a functional group.',
    elements: [
        { index: 1, id: 'AK101', name: 'Functional Identifier Code', type: 'ID', min: 2, max: 2 },
        { index: 2, id: 'AK102', name: 'Group Control Number', type: 'N0', min: 1, max: 9 }
    ]
  },
  AK2: {
    id: 'AK2',
    name: 'Transaction Set Response Header',
    purpose: 'To start acknowledgment of a single transaction set.',
    elements: [
        { index: 1, id: 'AK201', name: 'Transaction Set Identifier Code', type: 'ID', min: 3, max: 3 },
        { index: 2, id: 'AK202', name: 'Transaction Set Control Number', type: 'AN', min: 4, max: 9 }
    ]
  },
  AK5: {
    id: 'AK5',
    name: 'Transaction Set Response Trailer',
    purpose: 'To acknowledge acceptance or rejection and report errors in a transaction set.',
    elements: [
        { index: 1, id: 'AK501', name: 'Transaction Set Acknowledgment Code', type: 'ID', min: 1, max: 1, qualifiers: { 'A': 'Accepted', 'E': 'Accepted with Errors', 'R': 'Rejected' } }
    ]
  },
  AK9: {
    id: 'AK9',
    name: 'Functional Group Response Trailer',
    purpose: 'To acknowledge acceptance or rejection of a functional group and report the number of included transaction sets.',
    elements: [
        { index: 1, id: 'AK901', name: 'Functional Group Acknowledge Code', type: 'ID', min: 1, max: 1 },
        { index: 2, id: 'AK902', name: 'Number of Transaction Sets Included', type: 'N0', min: 1, max: 6 },
        { index: 3, id: 'AK903', name: 'Number of Received Transaction Sets', type: 'N0', min: 1, max: 6 },
        { index: 4, id: 'AK904', name: 'Number of Accepted Transaction Sets', type: 'N0', min: 1, max: 6 }
    ]
  },

  // --- X12 TRANSACTION HEADERS & DETAILS (EXISTING) ---
  BEG: {
    id: 'BEG',
    name: 'Beginning Segment for Purchase Order',
    purpose: 'To indicate the beginning of the Purchase Order Transaction Set (850).',
    elements: [
      { index: 1, id: 'BEG01', name: 'Transaction Set Purpose', type: 'ID', min: 2, max: 2, qualifiers: { '00': 'Original', '01': 'Cancellation', '06': 'Confirmation', '07': 'Duplicate' } },
      { index: 2, id: 'BEG02', name: 'Purchase Order Type', type: 'ID', min: 2, max: 2 },
      { index: 3, id: 'BEG03', name: 'Purchase Order Number', type: 'AN', min: 1, max: 22 },
      { index: 4, id: 'BEG04', name: 'Release Number', type: 'AN', min: 1, max: 30 },
      { index: 5, id: 'BEG05', name: 'Date', type: 'DT', min: 8, max: 8 },
    ],
  },
  PRF: {
    id: 'PRF',
    name: 'Purchase Order Reference',
    purpose: 'To provide reference to a specific purchase order.',
    elements: [
      { index: 1, id: 'PRF01', name: 'Purchase Order Number', type: 'AN', min: 1, max: 22 },
      { index: 4, id: 'PRF04', name: 'Date', type: 'DT', min: 8, max: 8 }
    ]
  },
  PO1: {
    id: 'PO1',
    name: 'Baseline Item Data',
    purpose: 'To specify basic and most frequently used line item data.',
    elements: [
      { index: 1, id: 'PO101', name: 'Assigned Identification', type: 'AN', min: 1, max: 20 },
      { index: 2, id: 'PO102', name: 'Quantity Ordered', type: 'R', min: 1, max: 15 },
      { index: 3, id: 'PO103', name: 'UOM Code', type: 'ID', min: 2, max: 2 },
      { index: 4, id: 'PO104', name: 'Unit Price', type: 'R', min: 1, max: 17 },
    ],
  },
  LIN: {
    id: 'LIN',
    name: 'Item Identification',
    purpose: 'To specify basic item identification data.',
    elements: [
      { index: 1, id: 'LIN01', name: 'Assigned Identification', type: 'AN', min: 1, max: 20 },
      { index: 2, id: 'LIN02', name: 'Product/Service ID Qualifier', type: 'ID', min: 2, max: 2 },
      { index: 3, id: 'LIN03', name: 'Product/Service ID', type: 'AN', min: 1, max: 48 },
    ],
  }
};
