import { Component, OnInit } from '@angular/core'
import { ActivatedRoute } from '@angular/router'
import { merge, Observable, of, timer } from 'rxjs'
import { switchMap } from 'rxjs/operators'
import { Store } from '@ngrx/store'
import { Actions, ofType } from '@ngrx/effects'

import { BaseComponent } from '@tezblock/components/base.component'
import { BlockService } from '@tezblock/services/blocks/blocks.service'
import { TransactionService } from '@tezblock/services/transaction/transaction.service'
import { Tab } from '@tezblock/components/tabbed-table/tabbed-table.component'
import { ApiService } from '@tezblock/services/api/api.service'
import * as fromRoot from '@tezblock/reducers'
import * as actions from './actions'
import { refreshRate } from '@tezblock/services/facade/facade'

//TODO: create some shared file for it
const getRefresh = (streams: Observable<any>[]): Observable<number> =>
  merge(of(-1), merge(streams).pipe(switchMap(() => timer(refreshRate, refreshRate))))

@Component({
  selector: 'app-list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss']
})
export class ListComponent extends BaseComponent implements OnInit {
  tabs: Tab[]
  page: string
  loading$: Observable<boolean>
  type: string
  data$: Observable<Object>
  componentView: string | undefined
  transactionsLoading$: Observable<boolean>
  totalActiveBakers$: Observable<number>
  activationsCountLast24h$: Observable<number>
  originationsCountLast24h$: Observable<number>
  transactionsCountLast24h$: Observable<number>

  private dataService

  private get routeName(): string {
    return this.route.snapshot.paramMap.get('route')
  }

  constructor(
    private readonly actions$: Actions,
    private readonly apiService: ApiService,
    private readonly route: ActivatedRoute,
    private readonly store$: Store<fromRoot.State>
  ) {
    super()
    this.store$.dispatch(actions.reset())
  }

  ngOnInit() {
    // is this refresh rly good .. ?
    const refresh$ = merge(
      of(1),
      merge(
        this.actions$.pipe(ofType(actions.loadActiveBakersFailed)),
        this.actions$.pipe(ofType(actions.loadActiveBakersSucceeded)),
        this.actions$.pipe(ofType(actions.loadDoubleBakingsFailed)),
        this.actions$.pipe(ofType(actions.loadDoubleBakingsSucceeded)),
        this.actions$.pipe(ofType(actions.loadDoubleEndorsementsFailed)),
        this.actions$.pipe(ofType(actions.loadDoubleEndorsementsSucceeded))
      ).pipe(switchMap(() => timer(refreshRate, refreshRate)))
    )

    this.route.params.subscribe(params => {
      try {
        switch (params.route) {
          case 'block':
            this.dataService = new BlockService(this.apiService)
            this.dataService.setPageSize(10)
            this.page = 'block'
            this.setupTable(params.route, 'overview')
            break
          case 'transaction':
            this.subscriptions.push(
              getRefresh([
                this.actions$.pipe(ofType(actions.loadTransactionsCountLast24hSucceeded)),
                this.actions$.pipe(ofType(actions.loadTransactionsCountLast24hFailed))
              ]).subscribe(() => this.store$.dispatch(actions.loadTransactionsCountLast24h()))
            )
            this.transactionsCountLast24h$ = this.store$.select(state => state.list.transactionsCountLast24h)
            this.dataService = new TransactionService(this.apiService)
            this.dataService.setPageSize(10)
            this.page = 'transaction'
            this.setupTable(params.route, 'overview')
            break
          case 'activation':
            this.subscriptions.push(
              getRefresh([
                this.actions$.pipe(ofType(actions.loadActivationsCountLast24hSucceeded)),
                this.actions$.pipe(ofType(actions.loadActivationsCountLast24hFailed))
              ]).subscribe(() => this.store$.dispatch(actions.loadActivationsCountLast24h()))
            )
            this.activationsCountLast24h$ = this.store$.select(state => state.list.activationsCountLast24h)
            this.dataService = new TransactionService(this.apiService)
            this.dataService.updateKind(['activate_account'])
            this.dataService.setPageSize(10)
            this.page = 'transaction'
            this.setupTable(params.route, 'activate_account')
            break
          case 'origination':
            this.subscriptions.push(
              getRefresh([
                this.actions$.pipe(ofType(actions.loadOriginationsCountLast24hSucceeded)),
                this.actions$.pipe(ofType(actions.loadOriginationsCountLast24hFailed))
              ]).subscribe(() => this.store$.dispatch(actions.loadOriginationsCountLast24h()))
            )
            this.originationsCountLast24h$ = this.store$.select(state => state.list.originationsCountLast24h)
            this.dataService = new TransactionService(this.apiService)
            this.dataService.updateKind(['origination'])
            this.dataService.setPageSize(10)
            this.page = 'transaction'
            this.setupTable(params.route, 'origination_overview')
            break
          case 'delegation':
            this.dataService = new TransactionService(this.apiService)
            this.dataService.updateKind(['delegation'])
            this.dataService.setPageSize(10)
            this.page = 'transaction'
            this.setupTable(params.route, 'delegation_overview')
            break
          case 'endorsement':
            this.dataService = new TransactionService(this.apiService)
            this.dataService.updateKind(['endorsement'])
            this.dataService.setPageSize(10)
            this.page = 'transaction'
            this.setupTable(params.route, 'endorsement_overview')
            break
          case 'vote':
            this.dataService = new TransactionService(this.apiService)
            this.dataService.updateKind(['ballot', 'proposals'])
            this.dataService.setPageSize(10)
            this.page = 'transaction'
            this.setupTable(params.route, 'ballot_overview')
            break
          case 'double-baking':
            this.subscriptions.push(refresh$.subscribe(() => this.store$.dispatch(actions.loadDoubleBakings())))
            this.loading$ = this.store$.select(state => state.list.doubleBakings.loading)
            this.data$ = this.store$.select(state => state.list.doubleBakings.data)
            this.page = 'transaction'
            this.type = 'double_baking_evidence_overview'
            break
          case 'double-endorsement':
            this.subscriptions.push(refresh$.subscribe(() => this.store$.dispatch(actions.loadDoubleEndorsements())))
            this.loading$ = this.store$.select(state => state.list.doubleEndorsements.loading)
            this.data$ = this.store$.select(state => state.list.doubleEndorsements.data)
            this.page = 'transaction'
            this.type = 'double_endorsement_evidence_overview'
            break
          case 'bakers':
            this.subscriptions.push(
              refresh$.subscribe(() => {
                this.store$.dispatch(actions.loadActiveBakers())
                this.store$.dispatch(actions.loadTotalActiveBakers())
              })
            )
            this.loading$ = this.store$.select(state => state.list.activeBakers.table.loading)
            this.data$ = this.store$.select(state => state.list.activeBakers.table.data)
            this.page = 'account'
            this.type = 'baker_overview'
            this.totalActiveBakers$ = this.store$.select(state => state.list.activeBakers.total)
            break
          default:
            throw new Error('unknown route')
        }
      } catch (error) {
        // tslint:disable-next-line:no-console
        console.warn(error)
      }
    })
  }

  loadMore() {
    switch (this.routeName) {
      case 'double-baking':
        this.store$.dispatch(actions.increasePageOfDoubleBakings())
        break
      case 'double-endorsement':
        this.store$.dispatch(actions.increasePageOfDoubleEndorsements())
        break
      case 'bakers':
        this.store$.dispatch(actions.increasePageOfActiveBakers())
        break
      default:
        ;(this.dataService as any).loadMore()
    }
  }

  private setupTable(route: string, type: string) {
    this.type = type
    this.loading$ = this.dataService.loading$
    this.data$ = this.dataService.list$
    this.componentView = route
  }
}
