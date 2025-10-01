export const addJitter = (ttl: number, jitterPercent: number): number => {
  const jitter = Math.random() * (jitterPercent / 100) * ttl;
  return Math.floor(ttl + jitter);
};

export const calculateLOS = (checkIn: string, checkOut: string): number => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
};

export const validateOccupancy = (roomOccupancy: any, adults: number, children: number): boolean => {
  if (!roomOccupancy) return false;
  return (roomOccupancy.adults + roomOccupancy.children) === (adults + children);
};

export const validateAvailability = (room: any, closedDates: any[], checkIn: string, checkOut: string, los: number): boolean => {
  const checkInDate = new Date(checkIn);
  const checkOutDate = new Date(checkOut);
  
  // Check if any date in range is closed
  const dateRange = [];
  for (let d = new Date(checkInDate); d < checkOutDate; d.setDate(d.getDate() + 1)) {
    dateRange.push(d.toISOString().split('T')[0]);
  }
  
  const closedDateStrings = closedDates.map(d => d.date);
  if (dateRange.some(date => closedDateStrings.includes(date))) {
    return false;
  }
  
  // Check arrival restrictions
  const closedToArrival = closedDates.filter(d => d.closed_to_arrival);
  if (closedToArrival.some(d => d.date === checkIn)) {
    return false;
  }
  
  // Check departure restrictions
  const checkOutPrev = new Date(checkOutDate);
  checkOutPrev.setDate(checkOutPrev.getDate() - 1);
  const closedToDeparture = closedDates.filter(d => d.closed_to_departure);
  if (closedToDeparture.some(d => d.date === checkOutPrev.toISOString().split('T')[0])) {
    return false;
  }
  
  // Check minimum stay
  if (room.min_stay_arrival && los < room.min_stay_arrival) {
    return false;
  }
  
  if (room.min_stay_through && los < room.min_stay_through) {
    return false;
  }
  
  return true;
};

export const getPropertyCacheKey = (propertyId: string): string => {
  return `property:${propertyId}:info`;
};

export const getRoomsCacheKey = (propertyId: string, checkIn: string, checkOut: string, adults: number, children: number = 0, infants: number = 0, currency: string = 'USD'): string => {
  return `rooms:${propertyId}:${checkIn}:${checkOut}:A${adults}-C${children}-I${infants}:CUR=${currency}`;
};

export const generateIdemKey = (params: any): string => {
  const { id, checkIn, checkOut, adults, children, infants, currency, idempotencyKey } = params;
  return `idem:${idempotencyKey}:${id}:${checkIn}:${checkOut}:A${adults}-C${children}-I${infants}:${currency}`;
};