export interface WishlistItem {
  listing_id: number;
  title: string;
  image: string;
  price: string;
}

export const getWishlistStorageKey = (userId: number | string | null): string => {
  if (!userId) {
    return 'bikehub_wishlist_guest';
  }
  return `bikehub_wishlist_${userId}`;
};

export const readWishlist = (userId: number | string | null): WishlistItem[] => {
  if (typeof window === 'undefined') {
    return [];
  }

  const raw = window.localStorage.getItem(getWishlistStorageKey(userId));
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as WishlistItem[];
  } catch (error) {
    console.error('[wishlist] Failed to parse stored wishlist', error);
    return [];
  }
};

export const saveWishlist = (userId: number | string | null, items: WishlistItem[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getWishlistStorageKey(userId), JSON.stringify(items));
  window.dispatchEvent(new Event('wishlistUpdated'));
};

export const clearWishlist = (userId: number | string | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(getWishlistStorageKey(userId));
  window.dispatchEvent(new Event('wishlistUpdated'));
};
