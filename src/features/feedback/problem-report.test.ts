import { afterEach, describe, expect, it } from 'vitest';

import {
  browserOf,
  mailtoHref,
  reportBody,
  reportSubject,
  technicalLines,
  type ReportEnvironment,
} from '@/features/feedback/problem-report';
import { forgetLastError, lastErrorMessage, listenForErrors, rememberError } from '@/lib/last-error';

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
const WINDOWS_YANDEX =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 YaBrowser/25.8.0.0 Safari/537.36';
const LINUX_FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:142.0) Gecko/20100101 Firefox/142.0';
const MAC_EDGE =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0';

const ENV: ReportEnvironment = {
  version: '0.18.0',
  page: '/plan?step=7',
  userAgent: ANDROID_CHROME,
  width: 390.4,
  height: 844,
  narrowScreen: true,
  installed: false,
  theme: 'dark',
  lastError: null,
};

afterEach(() => forgetLastError());

describe('a message about a problem: the browser', () => {
  it('names the browser people know and the system under it', () => {
    expect(browserOf(ANDROID_CHROME)).toBe('Chrome 140, Android');
    expect(browserOf(IPHONE_SAFARI)).toBe('Safari 18, iOS');
    expect(browserOf(WINDOWS_YANDEX)).toBe('Яндекс Браузер 25, Windows');
    expect(browserOf(LINUX_FIREFOX)).toBe('Firefox 142, Linux');
    expect(browserOf(MAC_EDGE)).toBe('Edge 140, macOS');
  });

  it('says so when it cannot tell', () => {
    expect(browserOf('')).toBe('не определён');
    expect(browserOf('curl/8.0')).toBe('не определён');
  });
});

describe('a message about a problem: the letter', () => {
  it('lists where and on what it happened, and nothing of the data', () => {
    expect(technicalLines(ENV)).toEqual([
      'Версия: 0.18.0',
      'Страница: /plan?step=7',
      'Устройство: телефон, окно 390×844',
      'Браузер: Chrome 140, Android',
      'Открыто: вкладка браузера',
      'Тема: тёмная',
      'Последняя ошибка: нет',
    ]);
    expect(
      technicalLines({ ...ENV, narrowScreen: false, installed: true, theme: 'light', lastError: 'Boom' }),
    ).toEqual(
      expect.arrayContaining([
        'Устройство: компьютер или планшет, окно 390×844',
        'Открыто: установленное приложение',
        'Тема: светлая',
        'Последняя ошибка: Boom',
      ]),
    );
  });

  it('puts the words of the person first and the technical lines after them, if they want them', () => {
    const lines = technicalLines(ENV);
    expect(reportBody('  Не сохраняется цель \n', lines)).toBe(
      ['Не сохраняется цель', '', 'Техническая информация:', ...lines].join('\n'),
    );
    expect(reportBody('Не сохраняется цель', null)).toBe('Не сохраняется цель');
  });

  it('builds a mailto link with the subject and the body encoded, line breaks as CRLF', () => {
    const href = mailtoHref('author@example.ru', reportSubject('0.18.0'), 'Первая строка\nВторая & третья?');
    expect(href.startsWith('mailto:author@example.ru?subject=')).toBe(true);

    const query = new URLSearchParams(href.slice(href.indexOf('?') + 1));
    expect(query.get('subject')).toBe('Конверкот 0.18.0: проблема');
    expect(query.get('body')).toBe('Первая строка\r\nВторая & третья?');
  });
});

describe('the last error', () => {
  it('keeps only the first line of the last error, and not too long a one', () => {
    expect(lastErrorMessage()).toBeNull();
    rememberError(new Error('Cannot read properties of undefined\n    at Widget (widget.tsx:10)'));
    expect(lastErrorMessage()).toBe('Cannot read properties of undefined');

    rememberError('x'.repeat(500));
    expect(lastErrorMessage()).toHaveLength(300);

    rememberError(undefined);
    expect(lastErrorMessage()).toHaveLength(300);
  });

  it('hears the errors no screen caught', () => {
    // a target of its own: an error event on the window of the tests would fail the run itself
    const target = new EventTarget() as unknown as Window;
    const stop = listenForErrors(target);
    target.dispatchEvent(
      new ErrorEvent('error', { message: 'Script error', error: new Error('Lost chunk') }),
    );
    expect(lastErrorMessage()).toBe('Lost chunk');

    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(rejection, 'reason', { value: new Error('Refused') });
    target.dispatchEvent(rejection);
    expect(lastErrorMessage()).toBe('Refused');

    stop();
    target.dispatchEvent(new ErrorEvent('error', { message: 'Later', error: new Error('Later') }));
    expect(lastErrorMessage()).toBe('Refused');
  });
});
