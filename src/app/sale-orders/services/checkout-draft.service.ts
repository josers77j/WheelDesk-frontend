import { QuotationDetail } from '../../quotations/interfaces/quotation.interface';
import { DiscountType } from '../interfaces/checkout.interface';
import { Injectable, signal } from '@angular/core';
import {
  CheckoutDocumentType,
  type CheckoutDraft,
} from '../interfaces/checkout.interface';

const DRAFT_KEY = 'workshop.sale-order.draft';

function newRequestId(): string {
  return crypto.randomUUID();
}

function emptyDraft(): CheckoutDraft {
  return {
    quotationId: null,
    requestId: newRequestId(),
    documentType: CheckoutDocumentType.INVOICE,
    documentTypeId: null,
    customerId: null,
    customerName: null,
    items: [],
    discountType: null,
    discountValue: null,
    payments: [],
    paymentTermId: null,
  };
}

function loadDraft(): CheckoutDraft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyDraft();
    const parsed = JSON.parse(raw) as Partial<CheckoutDraft>;
    // Sin requestId válido el borrador no sirve: evita duplicados.
    if (!parsed.requestId) return emptyDraft();
    return { ...emptyDraft(), ...parsed, requestId: parsed.requestId };
  } catch {
    return emptyDraft();
  }
}

/**
 * Borrador del checkout persistido en localStorage.
 *
 * El `requestId` es la llave anti-duplicados del backend: sobrevive recargas
 * y SOLO cambia al completar o cancelar la compra. Si cambiara con la misma
 * orden, el backend crearía un duplicado y sería culpa del front.
 */
@Injectable({
  providedIn: 'root',
})
export class CheckoutDraftService {
  draft = signal<CheckoutDraft>(loadDraft());

  seedFromQuotation(quotation: QuotationDetail): void {
    const draft = emptyDraft();
    this.draft.set({
      ...draft,
      quotationId: quotation.id,
      documentType: quotation.saleType ?? CheckoutDocumentType.INVOICE,
      customerId: quotation.customerId,
      customerName: quotation.customerId ? quotation.customer?.name ?? quotation.customerName : null,
      items: quotation.details.map((item) => ({
        productId: item.productId, name: item.productName, quantity: item.quantity,
        zoneId: null, zoneName: null, unitPrice: Number(item.unitPrice),
        unitPriceEstimate: item.unitPrice, lineTotal: item.amountAfterDiscount,
        discountType: DiscountType.USD, discountValue: Number(item.discountAmount),
      })),
      discountType: DiscountType.USD,
      discountValue: Number(quotation.globalDiscount),
    });
    this.persist();
  }

  persist() {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(this.draft()));
    } catch {
      // Sin almacenamiento no hay persistencia; el requestId en memoria sigue valiendo.
    }
  }

  /** Limpia el borrador y genera un requestId nuevo (compra completada o cancelada). */
  reset() {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignorar
    }
    this.draft.set(emptyDraft());
  }
}
