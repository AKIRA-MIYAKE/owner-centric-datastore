import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

export const validateDate: (date: string) => string[] = (date) => {
  const errorMessages: string[] = [];

  if (!dayjs(date, 'YYYY-MM-DD', true).isValid()) {
    errorMessages.push('"date" format is "YYYY-MM-DD"');
  }

  return errorMessages;
};

export const validateDatetime: (datetime: string) => string[] = (datetime) => {
  const errorMessages: string[] = [];

  if (
    (datetime.length !== 24 && datetime.length !== 29) ||
    !dayjs(datetime).isValid()
  ) {
    errorMessages.push('"datetime" format is "YYYY-MM-DDTHH:mm:ss.sssZ"');
  }

  return errorMessages;
};

export const validateTimezone: (timezone: string) => string[] = (timezone) => {
  const errorMessages: string[] = [];

  if (!/^(?:Z|([+-])(\d{2}):(\d{2}))$/.test(timezone)) {
    errorMessages.push('Invalid "timezone" format');
  }

  return errorMessages;
};

export const toDateISOString: (
  dateString: string,
  options?: {
    timezone?: string;
    isEndOf?: boolean;
  }
) => string = (dateString, options) => {
  const timezone = options && options.timezone;
  const isEndOf = options && options.isEndOf;

  const format = 'YYYY-MM-DD';

  if (!timezone) {
    if (isEndOf) {
      return dayjs(dateString, format).endOf('date').toISOString();
    } else {
      return dayjs(dateString, format).toISOString();
    }
  }

  const date = dayjs(`${dateString}T${timezone}`, `${format}TZ`);

  if (isEndOf) {
    return date.add(86400000 - 1, 'millisecond').toISOString();
  } else {
    return date.toISOString();
  }
};
