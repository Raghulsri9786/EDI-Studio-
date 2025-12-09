
import { ErpSchema } from '../types';

// Mock Drive Folder ID from prompt
const DRIVE_FOLDER_ID = "1PyL6c3BDQBRdTTi74LR0bIY-Ll3FaAE1";

// Updated XSD to match the HEB-Dreampack XSLT fields for realistic testing
const XSD_HEB_850 = `<?xml version="1.0" encoding="utf-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Envelope">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="FlatFile">
          <xs:complexType>
            <xs:sequence>
              <xs:element name="HDR" minOccurs="0" maxOccurs="unbounded">
                <xs:complexType>
                  <xs:attribute name="InternalTransactionId" type="xs:string"/>
                  <xs:attribute name="RecordID" type="xs:string" fixed="HDR"/>
                  <xs:attribute name="TradingPartnerCode" type="xs:string"/>
                  <xs:attribute name="CustomerPO" type="xs:string" use="required"/>
                  <xs:attribute name="ShiptoLocation" type="xs:string"/>
                  <xs:attribute name="BilltoLocation" type="xs:string"/>
                  <xs:attribute name="BillingCode" type="xs:string"/>
                  <xs:attribute name="BuyerName" type="xs:string"/>
                  <xs:attribute name="Phone" type="xs:string"/>
                  <xs:attribute name="TermsDescription" type="xs:string"/>
                  <xs:attribute name="ShipVia-Routing" type="xs:string"/>
                  <xs:attribute name="SpecialInstructions-1" type="xs:string"/>
                  <xs:attribute name="Department" type="xs:string"/>
                  <xs:attribute name="StartRequestShipDate" type="xs:date"/>
                  <xs:attribute name="CompletionCancelDate" type="xs:date"/>
                  <xs:attribute name="POType" type="xs:string"/>
                  <xs:attribute name="VendorNumber" type="xs:string"/>
                  <xs:attribute name="ShiptoName" type="xs:string"/>
                  <xs:attribute name="ShiptoAddress-1" type="xs:string"/>
                  <xs:attribute name="ShiptoCity" type="xs:string"/>
                  <xs:attribute name="ShiptoState" type="xs:string"/>
                  <xs:attribute name="ShiptoZip" type="xs:string"/>
                  <xs:attribute name="ShiptoCountry" type="xs:string"/>
                  <xs:attribute name="SenderID" type="xs:string"/>
                  <xs:attribute name="ReceiverID" type="xs:string"/>
                  <xs:attribute name="TransactionType" type="xs:string"/>
                </xs:complexType>
              </xs:element>
              <xs:element name="INF" minOccurs="0" maxOccurs="unbounded">
                 <xs:complexType>
                    <xs:attribute name="RecordID" type="xs:string" fixed="INF"/>
                    <xs:attribute name="StoreNumber" type="xs:string"/>
                    <xs:attribute name="PODate" type="xs:date"/>
                    <xs:attribute name="TermsPercent" type="xs:decimal"/>
                    <xs:attribute name="TermsDiscountDays" type="xs:integer"/>
                    <xs:attribute name="NetDays" type="xs:integer"/>
                 </xs:complexType>
              </xs:element>
              <xs:element name="DTL" minOccurs="0" maxOccurs="unbounded">
                <xs:complexType>
                  <xs:attribute name="RecordID" type="xs:string" fixed="DTL"/>
                  <xs:attribute name="LineNumber" type="xs:string"/>
                  <xs:attribute name="Style" type="xs:string"/>
                  <xs:attribute name="UPCNumber" type="xs:string"/>
                  <xs:attribute name="SKU" type="xs:string"/>
                  <xs:attribute name="ProductDescription" type="xs:string"/>
                  <xs:attribute name="Quantity" type="xs:decimal"/>
                  <xs:attribute name="UnitOfMeasure" type="xs:string"/>
                  <xs:attribute name="UnitPrice" type="xs:decimal"/>
                  <xs:attribute name="GTIN" type="xs:string"/>
                </xs:complexType>
              </xs:element>
            </xs:sequence>
          </xs:complexType>
        </xs:element>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

const XSD_856 = `<?xml version="1.0" encoding="utf-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="Envelope">
    <xs:complexType>
      <xs:sequence>
        <xs:element name="FlatFile">
           <xs:element name="SHIPMENT" minOccurs="0" maxOccurs="unbounded">
              <xs:attribute name="ShipmentID" type="xs:string"/>
              <xs:attribute name="SCAC" type="xs:string"/>
              <xs:attribute name="TrackingNumber" type="xs:string"/>
           </xs:element>
        </xs:element>
      </xs:sequence>
    </xs:complexType>
  </xs:element>
</xs:schema>`;

const MOCK_SCHEMAS: Record<string, ErpSchema> = {
  '850': {
    transactionType: '850',
    name: 'EDIDirectInbound850FF.xsd',
    rawContent: XSD_HEB_850,
    root: { id: 'root', name: 'Envelope', type: 'object', children: [] }
  },
  '856': {
    transactionType: '856',
    name: 'EDIDirectInbound856FF.xsd',
    rawContent: XSD_856,
    root: { id: 'root', name: 'Envelope', type: 'object', children: [] }
  }
};

export const connectToDrive = async (): Promise<boolean> => {
  // Simulate OAuth delay
  return new Promise(resolve => setTimeout(() => resolve(true), 1000));
};

export const listSchemas = async (): Promise<ErpSchema[]> => {
    // Simulate listing files in the folder
    await new Promise(resolve => setTimeout(resolve, 500));
    return Object.values(MOCK_SCHEMAS);
};

export const fetchSchemaFromDrive = async (transactionSet: string): Promise<ErpSchema | null> => {
  await new Promise(resolve => setTimeout(resolve, 600));
  
  if (MOCK_SCHEMAS[transactionSet]) {
    return MOCK_SCHEMAS[transactionSet];
  }
  
  // Default/Fallback
  return {
    transactionType: transactionSet,
    name: `EDIDirectInbound${transactionSet}FF.xsd`,
    rawContent: `<!-- Generic Schema for ${transactionSet} -->`,
    root: { id: 'root', name: 'Envelope', type: 'object', children: [] }
  };
};
