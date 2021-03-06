import { HttpClient } from '@angular/common/http'
import { Injectable } from '@angular/core'
import * as moment from 'moment'
import { Observable, of, from } from 'rxjs'
import { map, switchMap, tap } from 'rxjs/operators'
import { TezosProtocol } from 'airgap-coin-lib'

import { BakingBadResponse } from 'src/app/interfaces/BakingBadResponse'
import { MyTezosBakerResponse } from 'src/app/interfaces/MyTezosBakerResponse'
import { TezosBakerResponse, Baker } from 'src/app/interfaces/TezosBakerResponse'
import { ChainNetworkService } from '../chain-network/chain-network.service'
import { first } from '@tezblock/services/fp'
import { get as _get } from 'lodash'
import { CacheService, CacheKeys, CurrentCycleState } from '@tezblock/services/cache/cache.service'
import { BaseService, Operation } from '@tezblock/services/base.service'

interface TezosNodesApiResponse {
  name: string
  address: string
  efficiency_last10cycle: number
  freespace: number
  last_endoresment: string
  last_baking: string
  next_endoresment: string
  next_baking: string
}

type Moment = moment.Moment
const hoursPerCycle = 68

@Injectable({
  providedIn: 'root'
})
export class BakingService extends BaseService {
  private readonly bakingBadUrl = 'https://api.baking-bad.org/v2/bakers'
  private readonly tezosBakerUrl = 'https://api.mytezosbaker.com/v1/bakers/'
  private readonly efficiencyLast10CyclesUrl = 'https://api.tezos-nodes.com/v1/baker/'
  private readonly airgapCorsProxy = 'https://cors-proxy.airgap.prod.gke.papers.tech/proxy?url='

  constructor(
    private readonly cacheService: CacheService,
    private readonly http: HttpClient,
    readonly chainNetworkService: ChainNetworkService
  ) {
    super(chainNetworkService, http)
  }

  getBakingBadRatings(address: string): Observable<BakingBadResponse> {
    return this.http
      .get<BakingBadResponse>(`${this.bakingBadUrl}/${address}`, {
        params: { configs: 'true', insurance: 'true' }
      })
      .pipe(
        map(response => ({
          ...response,
          status: response ? 'success' : 'error'
        }))
      )
  }

  getTezosBakerInfos(address: string): Promise<MyTezosBakerResponse> {
    return new Promise(resolve => {
      this.cacheService
        .get(CacheKeys.fromCurrentCycle)
        .pipe(
          switchMap(currentCycleCache => {
            const myTezosBaker = _get(currentCycleCache, 'myTezosBaker')

            if (myTezosBaker) {
              return of(myTezosBaker)
            }

            return this.http.get<TezosBakerResponse>(this.tezosBakerUrl).pipe(
              tap(myTezosBaker =>
                this.cacheService.update<CurrentCycleState>(CacheKeys.fromCurrentCycle, currentCycleCache => ({
                  ...currentCycleCache,
                  myTezosBaker
                }))
              )
            )
          })
        )
        .subscribe(
          (response: TezosBakerResponse) => {
            const match: Baker = response.bakers.find(baker => baker.delegation_code === address)

            if (match) {
              resolve({
                status: 'success',
                rating: match.baker_efficiency,
                fee: match.fee,
                myTB: match.voting,
                baker_name: match.baker_name,
                delegation_code: match.delegation_code
              })

              return
            }

            resolve({ status: 'error' })
          },
          (/* error */) => resolve({ status: 'error' })
        )
    })
  }

  getBakerInfos(tzAddress: string): Observable<any> {
    return this.post<any[]>('delegates', {
      predicates: [
        {
          field: 'pkh',
          operation: Operation.eq,
          set: [tzAddress],
          inverse: false
        }
      ]
    }).pipe(map(first))
  }

  getStakingCapacityFromTezosProtocol(tzAddress: string): Observable<number> {
    const network = this.chainNetworkService.getNetwork()
    const tezosProtocol = new TezosProtocol(
      this.environmentUrls.rpcUrl,
      this.environmentUrls.conseilUrl,
      network,
      this.chainNetworkService.getEnvironmentVariable(),
      this.environmentUrls.conseilApiKey
    )

    return from(tezosProtocol.bakerInfo(tzAddress)).pipe(map(response => response.bakerCapacity.multipliedBy(0.7).toNumber()))
  }

  addPayoutDelayToMoment(time: Moment): Moment {
    return time.add(hoursPerCycle * 7 + 0, 'h')
  }

  getEfficiencyLast10Cycles(address: string): Observable<number> {
    return this.http
      .get<TezosNodesApiResponse>(`${this.airgapCorsProxy}${this.efficiencyLast10CyclesUrl}${address}`)
      .pipe(map(response => response.efficiency_last10cycle))
  }
}
