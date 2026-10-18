import { ValueParams } from '../../shared/components/combobox/interfaces/search-param.interface';

export interface CompanySettings {
  id: number;
  legalName: string;
  tradeName: string | null;
  nit: string;
  nrc: string | null;
  registryNo: string | null;
  address: string;
  districtId: number | null;
  economicActivityId: number;
  economicActivity: ValueParams;
  responsableName: string | null;
  responsableDocTypeId: number | null;
  responsableDocTypeCatalog: ValueParams | null;
  responsableDocNumber: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  ivaRate: number | null;
  district: {
    id: number;
    name: string;
    municipality: {
      id: number;
      name: string;
      department: ValueParams;
    };
  } | null;
}

export type UpdateCompanySettings = Omit<
  CompanySettings,
  'id' | 'district' | 'economicActivity' | 'responsableDocTypeCatalog'
>;
