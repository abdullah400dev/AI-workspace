import * as React from "react"
import { SVGProps } from "react"

interface IconProps extends SVGProps<SVGSVGElement> {
  className?: string;
}

export const Icons = {
  slack: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      {...props}
    >
      <path d="M6.194 14.644c0 1.16-.943 2.107-2.103 2.107a2.11 2.11 0 0 1-2.104-2.107 2.11 2.11 0 0 1 2.104-2.106h2.103v2.106zm1.061 0c0-1.16.944-2.106 2.104-2.106 1.16 0 2.103.945 2.103 2.106v5.274a2.11 2.11 0 0 1-2.103 2.106 2.11 2.11 0 0 1-2.104-2.106v-5.274zM9.36 6.208c-1.16 0-2.104-.945-2.104-2.106 0-1.16.943-2.107 2.104-2.107 1.16 0 2.103.946 2.103 2.107v2.106H9.36zm0 1.06h5.274c1.16 0 2.103.945 2.103 2.106 0 1.16-.943 2.107-2.103 2.107H9.36a2.11 2.11 0 0 1-2.104-2.107c0-1.16.943-2.106 2.104-2.106zM17.81 9.374c1.16 0 2.104-.945 2.104-2.106 0-1.16-.943-2.107-2.104-2.107a2.11 2.11 0 0 0-2.103 2.107v2.106h2.103zm-1.061 0v5.274c0 1.16.944 2.106 2.104 2.106 1.16 0 2.103-.945 2.103-2.106 0-1.16-.943-2.107-2.103-2.107h-2.104zM14.634 17.81c0-1.16-.944-2.106-2.104-2.106-1.16 0-2.103.945-2.103 2.106 0 1.16.943 2.107 2.103 2.107h2.104V17.81zm-1.06 0v-5.274c0-1.16-.944-2.106-2.104-2.106a2.11 2.11 0 0 0-2.103 2.106c0 1.16.943 2.107 2.103 2.107h5.274z" />
    </svg>
  ),
  spinner: (props: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  ),
}
