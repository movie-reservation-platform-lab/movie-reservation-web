import { useCallback, useMemo, useState } from "react";
import { Activity, AlertTriangle, Film } from "lucide-react";

import { createDemoTraceContext } from "../../../platform/observability/trace-context";
import { createMovieReservationApi } from "../adapters/graphql/movie-reservation-api";
import { useGraphqlExchangeLog } from "../adapters/react/use-graphql-exchange-log";
import { useMovieCatalog } from "../adapters/react/use-movie-catalog";
import { useReservationWorkflow } from "../adapters/react/use-reservation-workflow";
import { CatalogPanel } from "./catalog-panel";
import { DiagnosticsPanel } from "./diagnostics-panel";
import { ReservationPanel } from "./reservation-panel";
import { ScreeningPanel } from "./screening-panel";
import { SeatMap } from "./seat-map";

/**
 * Feature composition root for the reservation demo page.
 *
 * This component wires adapters and UI components together while keeping domain
 * rules and API details in their own modules.
 */
export function MovieReservationDemo() {
  const [workflow, setWorkflow] = useState(() => createDemoTraceContext());
  const {
    latestExchange,
    exchanges,
    recordExchange,
    resetExchangeLog,
  } = useGraphqlExchangeLog();
  const api = useMemo(
    () =>
      createMovieReservationApi({
        workflow,
        onExchange: recordExchange,
      }),
    [recordExchange, workflow],
  );
  const {
    catalog,
    isLoading: isCatalogLoading,
    error: catalogError,
    selectedMovieId,
    selectedScreeningId,
    selectedMovie,
    movieScreenings,
    selectedScreening,
    reloadCatalog,
    selectMovie,
    selectScreening,
  } = useMovieCatalog({ api });
  const {
    selectedSeatIds,
    selectedSeats,
    reservationRequest,
    reservationResult,
    error: reservationError,
    isSubmitting,
    isPolling,
    toggleSeat,
    submitReservation,
    resetReservation,
    clearReservationError,
  } = useReservationWorkflow({ api, selectedScreening });

  const handleMovieSelect = useCallback(
    (movieId: string) => {
      selectMovie(movieId);
      resetReservation();
    },
    [resetReservation, selectMovie],
  );

  const handleScreeningSelect = useCallback(
    (screeningId: string) => {
      selectScreening(screeningId);
      resetReservation();
    },
    [resetReservation, selectScreening],
  );

  const handleCatalogReload = useCallback(() => {
    clearReservationError();
    void reloadCatalog();
  }, [clearReservationError, reloadCatalog]);

  const handleNewWorkflow = useCallback(() => {
    resetReservation();
    setWorkflow(createDemoTraceContext());
    resetExchangeLog();
  }, [resetExchangeLog, resetReservation]);

  return (
    <main className="app-shell">
      <header className="top-bar">
        <div className="brand-mark" aria-hidden="true">
          <Film size={24} />
        </div>
        <div>
          <p className="eyebrow">Golden Path Cinema</p>
          <h1>Reservation control room</h1>
        </div>
        <div className="signal-pill">
          <Activity aria-hidden="true" size={16} />
          Observable workflow
        </div>
      </header>

      {catalogError !== undefined ? (
        <div className="page-alert" role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          {catalogError}
        </div>
      ) : null}

      <div className="workspace-grid">
        <CatalogPanel
          catalog={catalog}
          isLoading={isCatalogLoading}
          selectedMovieId={selectedMovieId}
          onMovieSelect={handleMovieSelect}
          onReload={handleCatalogReload}
        />

        <div className="center-stack">
          <ScreeningPanel
            movie={selectedMovie}
            screenings={movieScreenings}
            selectedScreeningId={selectedScreeningId}
            onScreeningSelect={handleScreeningSelect}
          />
          <SeatMap
            screening={selectedScreening}
            selectedSeatIds={selectedSeatIds}
            onSeatToggle={toggleSeat}
          />
        </div>

        <div className="right-stack">
          <ReservationPanel
            movie={selectedMovie}
            screening={selectedScreening}
            selectedSeats={selectedSeats}
            reservationRequest={reservationRequest}
            reservationResult={reservationResult}
            isSubmitting={isSubmitting}
            isPolling={isPolling}
            error={reservationError}
            onSubmit={submitReservation}
            onReset={resetReservation}
          />
          <DiagnosticsPanel
            workflow={workflow}
            latestExchange={latestExchange}
            exchanges={exchanges}
            reservationRequest={reservationRequest}
            onNewWorkflow={handleNewWorkflow}
          />
        </div>
      </div>
    </main>
  );
}
