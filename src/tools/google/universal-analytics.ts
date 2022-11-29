import {google} from 'googleapis';

export const analyticsReporting = google.analyticsreporting('v4');
export const analyticsScopes = ['https://www.googleapis.com/auth/analytics.readonly'];

// See https://developers.google.com/analytics/devguides/reporting/core/v4
// and https://ga-dev-tools.web.app/request-composer/metric-expression/

type DateUnit = 'day' | 'week' | 'month' | 'year';

export interface AnalyticsOptions {
  viewId: string,
  pageSize?: number,
  dateRange?: { range: number, unit: DateUnit, granularity?: DateUnit },
}