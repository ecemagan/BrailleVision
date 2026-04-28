"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ConversionReviewReader } from "@/components/dashboard/ConversionReviewReader";

export default function DashboardReviewPage() {
  return (
    <ProtectedRoute>
      <ConversionReviewReader />
    </ProtectedRoute>
  );
}
