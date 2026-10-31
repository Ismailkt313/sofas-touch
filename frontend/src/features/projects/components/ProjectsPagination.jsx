import React from 'react'
import { Pagination } from '../../../components/common/Pagination'

export function ProjectsPagination({
  activePage,
  totalPages,
  totalMatching,
  pageSize = 10,
  pageSizeOptions = [10, 20, 50],
  onPageChange,
  onPageSizeChange,
}) {
  return (
    <Pagination
      page={activePage}
      totalPages={totalPages}
      totalItems={totalMatching}
      pageSize={pageSize}
      pageSizeOptions={pageSizeOptions}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      itemName="project"
    />
  )
}

export default ProjectsPagination
