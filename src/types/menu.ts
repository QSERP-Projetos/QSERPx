export type SubMenuItem = {
  title: string;
  transactionCode: string;
};

export type MenuItem = {
  id: string;
  title: string;
  icon: string;
  transactionCode: string;
  subitems: SubMenuItem[];
};
