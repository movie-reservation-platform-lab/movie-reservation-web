import { useCallback, useState } from "react";

import type { GraphqlExchange } from "../../../../platform/api/graphql-client";

const maxRecordedExchanges = 8;

/**
 * In-memory log of recent GraphQL calls displayed by the diagnostics panel.
 */
export interface GraphqlExchangeLog {
  readonly latestExchange: GraphqlExchange | undefined;
  readonly exchanges: readonly GraphqlExchange[];
  readonly recordExchange: (exchange: GraphqlExchange) => void;
  readonly resetExchangeLog: () => void;
}

/**
 * React hook that records a small rolling window of GraphQL exchanges.
 */
export function useGraphqlExchangeLog(): GraphqlExchangeLog {
  const [latestExchange, setLatestExchange] = useState<GraphqlExchange>();
  const [exchanges, setExchanges] = useState<readonly GraphqlExchange[]>([]);

  const recordExchange = useCallback((exchange: GraphqlExchange) => {
    setLatestExchange(exchange);
    setExchanges((currentExchanges) =>
      [exchange, ...currentExchanges].slice(0, maxRecordedExchanges),
    );
  }, []);

  const resetExchangeLog = useCallback(() => {
    setLatestExchange(undefined);
    setExchanges([]);
  }, []);

  return {
    latestExchange,
    exchanges,
    recordExchange,
    resetExchangeLog,
  };
}
