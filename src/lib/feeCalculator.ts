const calculateCheckInFee = (sale: SaleRecord): number => {
  // STEP 1: Invoiced always wins
  if (sale.invoiced_check_in_fee != null && sale.invoiced_check_in_fee !== 0) {
    return Math.abs(sale.invoiced_check_in_fee);
  }

  // STEP 2: Boxes override
  const masterProgram = (sale.master_program_name || '').toLowerCase();
  if (masterProgram.includes('boxes')) {
    return 1.30;
  }

  // STEP 3: Category + Program lookup
  const lookupFee = getCheckInFeeFromLookup(
    sale.category_name ?? null,
    sale.program_name ?? null
  );

  if (lookupFee > 0) return lookupFee;

  return 0;
};
