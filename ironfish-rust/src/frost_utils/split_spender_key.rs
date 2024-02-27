/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

use group::GroupEncoding;
use ironfish_frost::participant::Identity;
use ironfish_frost::{frost::keys::KeyPackage, keys::PublicKeyPackage};
use ironfish_zkp::constants::PROOF_GENERATION_KEY_GENERATOR;
use jubjub::SubgroupPoint;
use rand::thread_rng;
use std::collections::HashMap;

use crate::{
    errors::{IronfishError, IronfishErrorKind},
    IncomingViewKey, OutgoingViewKey, PublicAddress, SaplingKey, ViewKey,
};

use super::split_secret::{split_secret, SecretShareConfig};

pub struct TrustedDealerKeyPackages {
    pub proof_authorizing_key: jubjub::Fr,
    pub view_key: ViewKey,
    pub incoming_view_key: IncomingViewKey,
    pub outgoing_view_key: OutgoingViewKey,
    pub public_address: PublicAddress,
    pub key_packages: HashMap<Identity, KeyPackage>,
    pub public_key_package: PublicKeyPackage,
}

pub fn split_spender_key(
    spender_key: &SaplingKey,
    min_signers: u16,
    identities: Vec<Identity>,
) -> Result<TrustedDealerKeyPackages, IronfishError> {
    let secret = spender_key.spend_authorizing_key.to_bytes().to_vec();

    let secret_config = SecretShareConfig {
        min_signers,
        identities,
        secret,
    };

    let (key_packages, public_key_package) = split_secret(&secret_config, thread_rng())?;

    let proof_authorizing_key = spender_key.sapling_proof_generation_key().nsk;

    let authorizing_key = public_key_package.verifying_key().serialize();
    let authorizing_key = Option::from(SubgroupPoint::from_bytes(&authorizing_key))
        .ok_or_else(|| IronfishError::new(IronfishErrorKind::InvalidAuthorizingKey))?;
    let nullifier_deriving_key =
        *PROOF_GENERATION_KEY_GENERATOR * spender_key.sapling_proof_generation_key().nsk;
    let view_key = ViewKey {
        authorizing_key,
        nullifier_deriving_key,
    };

    let incoming_view_key = spender_key.incoming_view_key().clone();
    let outgoing_view_key: OutgoingViewKey = spender_key.outgoing_view_key().clone();

    let public_address = incoming_view_key.public_address();

    Ok(TrustedDealerKeyPackages {
        proof_authorizing_key,
        view_key,
        incoming_view_key,
        outgoing_view_key,
        public_address,
        key_packages,
        public_key_package,
    })
}

#[cfg(test)]
mod test {
    use crate::test_util::create_multisig_identities;

    use super::*;
    use ironfish_frost::frost::{frost::keys::reconstruct, JubjubBlake2b512};

    #[test]
    fn test_split_spender_key_success() {
        let identities = create_multisig_identities(10);

        let mut cloned_identities = identities.clone();
        cloned_identities.sort_by_key(Identity::serialize);

        let sapling_key = SaplingKey::generate_key();

        let trusted_dealer_key_packages =
            split_spender_key(&sapling_key, 5, identities).expect("spender key split failed");

        assert_eq!(
            trusted_dealer_key_packages.key_packages.len(),
            10,
            "should have 10 key packages"
        );

        assert_eq!(
            trusted_dealer_key_packages.view_key.to_bytes(),
            sapling_key.view_key.to_bytes(),
            "should have the same incoming viewing key"
        );

        assert_eq!(
            trusted_dealer_key_packages.public_address,
            sapling_key.public_address(),
            "should have the same public address"
        );

        let spend_auth_key = sapling_key.spend_authorizing_key.to_bytes();

        let key_parts: Vec<_> = trusted_dealer_key_packages
            .key_packages
            .values()
            .cloned()
            .collect();

        let signing_key =
            reconstruct::<JubjubBlake2b512>(&key_parts).expect("key reconstruction failed");

        let scalar = signing_key.to_scalar();

        assert_eq!(scalar.to_bytes(), spend_auth_key);

        // assert identities and trusted_dealer_key_packages.key_packages.keys() are the same
        let mut t_identities = trusted_dealer_key_packages
            .key_packages
            .keys()
            .cloned()
            .collect::<Vec<_>>();

        t_identities.sort_by_key(Identity::serialize);
        assert_eq!(t_identities, cloned_identities);
    }
}
