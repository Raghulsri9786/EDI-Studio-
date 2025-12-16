
import { TransactionDef } from '../types';

export const X12_STRUCTURES: Record<string, TransactionDef> = {
  '850': {
    type: '850',
    structure: [
      { id: 'ST', req: true },
      { id: 'BEG', req: true },
      { id: 'CUR', req: false },
      { id: 'REF', req: false, repeat: true },
      { id: 'PER', req: false, repeat: true },
      { id: 'TAX', req: false, repeat: true },
      { id: 'FOB', req: false },
      { id: 'CTP', req: false, repeat: true },
      { id: 'PAM', req: false, repeat: true },
      { id: 'CSH', req: false },
      { id: 'SAC', req: false, repeat: true },
      { id: 'ITD', req: false, repeat: true },
      { id: 'DTM', req: false, repeat: true },
      { id: 'TD5', req: false, repeat: true },
      // N9 Loop
      { 
        id: 'N9', req: false, repeat: true, loop: true,
        children: [
           { id: 'N9', req: true },
           { id: 'DTM', req: false, repeat: true },
           { id: 'MSG', req: false, repeat: true }
        ]
      },
      // N1 Loop (Header)
      { 
        id: 'N1', req: false, repeat: true, loop: true, 
        children: [
          { id: 'N1', req: true },
          { id: 'N2', req: false, repeat: true },
          { id: 'N3', req: false, repeat: true },
          { id: 'N4', req: false },
          { id: 'REF', req: false, repeat: true },
          { id: 'PER', req: false, repeat: true }
        ]
      },
      // PO1 Loop (Details)
      {
        id: 'PO1', req: true, repeat: true, loop: true,
        children: [
          { id: 'PO1', req: true },
          { id: 'LIN', req: false, repeat: true },
          { id: 'SI', req: false, repeat: true },
          { id: 'CUR', req: false },
          { id: 'PID', req: false, repeat: true },
          { id: 'MEA', req: false, repeat: true },
          { id: 'PWK', req: false, repeat: true },
          { id: 'PKG', req: false, repeat: true },
          { id: 'PO4', req: false },
          { id: 'REF', req: false, repeat: true },
          { id: 'PER', req: false, repeat: true },
          { id: 'SAC', req: false, repeat: true },
          { id: 'IT8', req: false },
          { id: 'ITD', req: false, repeat: true },
          { id: 'DIS', req: false, repeat: true },
          { id: 'INC', req: false, repeat: true },
          { id: 'TAX', req: false, repeat: true },
          { id: 'FOB', req: false, repeat: true },
          { id: 'SDQ', req: false, repeat: true },
          { id: 'DTM', req: false, repeat: true },
          { id: 'TD5', req: false, repeat: true },
          // PID Loop inside PO1? Simplified for now
          // SLN Loop inside PO1
          { 
             id: 'SLN', req: false, repeat: true, loop: true,
             children: [
                { id: 'SLN', req: true },
                { id: 'DTM', req: false },
                { id: 'REF', req: false, repeat: true },
                { id: 'PID', req: false, repeat: true }
             ]
          }
        ]
      },
      { id: 'CTT', req: false },
      { id: 'AMT', req: false },
      { id: 'SE', req: true }
    ]
  },
  '810': {
    type: '810',
    structure: [
      { id: 'ST', req: true },
      { id: 'BIG', req: true },
      { id: 'NTE', req: false, repeat: true },
      { id: 'CUR', req: false },
      { id: 'REF', req: false, repeat: true },
      // N1 Loop
      { 
        id: 'N1', req: false, repeat: true, loop: true, 
        children: [
          { id: 'N1', req: true },
          { id: 'N2', req: false, repeat: true },
          { id: 'N3', req: false, repeat: true },
          { id: 'N4', req: false },
          { id: 'REF', req: false, repeat: true },
          { id: 'PER', req: false, repeat: true }
        ]
      },
      { id: 'ITD', req: false, repeat: true },
      { id: 'DTM', req: false, repeat: true },
      { id: 'FOB', req: false },
      // IT1 Loop
      {
        id: 'IT1', req: true, repeat: true, loop: true,
        children: [
          { id: 'IT1', req: true },
          { id: 'CRC', req: false, repeat: true },
          { id: 'QTY', req: false, repeat: true },
          { id: 'CUR', req: false },
          { id: 'REF', req: false, repeat: true },
          { id: 'ITD', req: false, repeat: true },
          { id: 'DTM', req: false, repeat: true },
          { id: 'TAX', req: false, repeat: true },
          { id: 'PID', req: false, repeat: true },
          { id: 'SAC', req: false, repeat: true },
          { id: 'PO4', req: false }
        ]
      },
      { id: 'TDS', req: true },
      { id: 'TXI', req: false, repeat: true },
      { id: 'CAD', req: false },
      { id: 'AMT', req: false, repeat: true },
      { id: 'SAC', req: false, repeat: true },
      { id: 'ISS', req: false, repeat: true },
      { id: 'CTT', req: false },
      { id: 'SE', req: true }
    ]
  },
  '856': {
    type: '856',
    structure: [
        { id: 'ST', req: true },
        { id: 'BSN', req: true },
        { id: 'DTM', req: false, repeat: true },
        // Hierarchical Loop
        { 
            id: 'HL', req: true, repeat: true, loop: true,
            children: [
                { id: 'HL', req: true },
                { id: 'LIN', req: false },
                { id: 'SN1', req: false },
                { id: 'SLN', req: false },
                { id: 'PRF', req: false },
                { id: 'PO4', req: false },
                { id: 'PID', req: false },
                { id: 'MEA', req: false },
                { id: 'PWK', req: false },
                { id: 'PKG', req: false },
                { id: 'TD1', req: false },
                { id: 'TD5', req: false },
                { id: 'TD3', req: false },
                { id: 'TD4', req: false },
                { id: 'REF', req: false, repeat: true },
                { id: 'PER', req: false },
                { id: 'CLD', req: false },
                { id: 'MAN', req: false, repeat: true },
                { id: 'DTM', req: false },
                { id: 'N1', req: false, repeat: true, loop: true, children: [
                    { id: 'N1', req: true },
                    { id: 'N2', req: false },
                    { id: 'N3', req: false },
                    { id: 'N4', req: false }
                ]}
            ]
        },
        { id: 'CTT', req: false },
        { id: 'SE', req: true }
    ]
  }
};
