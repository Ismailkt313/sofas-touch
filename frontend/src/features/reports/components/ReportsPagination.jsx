import React from 'react'
import { Pagination } from '../../../components/common/Pagination'

export function ReportsPagination({
  page,
  totalPages,
  totalItems,
  limit = 10,
  pageSizeOptions = [10, 20, 50],
  onPageChange,
  onPageSizeChange,
}) {
  return (
    <Pagination
      page={page}
      totalPages={totalPages}
      totalItems={totalItems}
      pageSize={limit}
      pageSizeOptions={pageSizeOptions}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      itemName="project report"
      itemsName="project reports"
    />
  )
}

export default ReportsPagination
