export const CURRENT_USER_ID = 1;

export type CurrentUserRole = {
  id: number;
  name: string;
  isGlobalAdmin: boolean;
  isCompanyAdmin: boolean;
};

export const currentUser: CurrentUserRole = {
  id: CURRENT_USER_ID,
  name: "JJ",
  isGlobalAdmin: true,
  isCompanyAdmin: true,
};