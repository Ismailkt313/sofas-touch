import React from 'react'
import { Pagination } from '../../../components/common/Pagination'

export function UsersPagination({
  activePage,
  totalPages,
  totalFiltered,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  onPageChange,
  onPageSizeChange,
}) {
  return (
    <Pagination
      page={activePage}
      totalPages={totalPages}
      totalItems={totalFiltered}
      pageSize={pageSize}
      pageSizeOptions={pageSizeOptions}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      itemName="user"
    />
  )
}

export default UsersPagination
