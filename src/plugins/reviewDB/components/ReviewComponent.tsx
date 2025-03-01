/*
 * Vencord, a modification for Discord's desktop app
 * Copyright (c) 2022 Vendicated and contributors
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { classes } from "@utils/misc";
import { LazyComponent } from "@utils/react";
import { filters, findBulk } from "@webpack";
import { Alerts, moment, Timestamp, UserStore } from "@webpack/common";

import { Review, ReviewType } from "../entities";
import { deleteReview, reportReview } from "../reviewDbApi";
import { settings } from "../settings";
import { canDeleteReview, cl, openUserProfileModal, showToast } from "../utils";
import { DeleteButton, ReportButton } from "./MessageButton";
import ReviewBadge from "./ReviewBadge";

export default LazyComponent(() => {
    // this is terrible, blame mantika
    const p = filters.byProps;
    const [
        { cozyMessage, buttons, message, groupStart },
        { container, isHeader },
        { avatar, clickable, username, messageContent, wrapper, cozy },
        buttonClasses,
        botTag
    ] = findBulk(
        p("cozyMessage"),
        p("container", "isHeader"),
        p("avatar", "zalgo"),
        p("button", "wrapper", "selected"),
        p("botTag")
    );

    const dateFormat = new Intl.DateTimeFormat();

    return function ReviewComponent({ review, refetch }: { review: Review; refetch(): void; }) {
        function openModal() {
            openUserProfileModal(review.sender.discordID);
        }

        function delReview() {
            Alerts.show({
                title: "Are you sure?",
                body: "Do you really want to delete this review?",
                confirmText: "Delete",
                cancelText: "Nevermind",
                onConfirm: () => {
                    deleteReview(review.id).then(res => {
                        if (res.success) {
                            refetch();
                        }
                        showToast(res.message);
                    });
                }
            });
        }

        function reportRev() {
            Alerts.show({
                title: "Are you sure?",
                body: "Do you really you want to report this review?",
                confirmText: "Report",
                cancelText: "Nevermind",
                // confirmColor: "red", this just adds a class name and breaks the submit button guh
                onConfirm: () => reportReview(review.id)
            });
        }

        return (
            <div className={classes(cozyMessage, wrapper, message, groupStart, cozy, cl("review"))} style={
                {
                    marginLeft: "0px",
                    paddingLeft: "52px", // wth is this
                    paddingRight: "16px"
                }
            }>

                <img
                    className={classes(avatar, clickable)}
                    onClick={openModal}
                    src={review.sender.profilePhoto || "/assets/1f0bfc0865d324c2587920a7d80c609b.png?size=128"}
                    style={{ left: "0px" }}
                />
                <div style={{ display: "inline-flex", justifyContent: "center", alignItems: "center" }}>
                    <span
                        className={classes(clickable, username)}
                        style={{ color: "var(--channels-default)", fontSize: "14px" }}
                        onClick={() => openModal()}
                    >
                        {review.sender.username}
                    </span>

                    {review.type === ReviewType.System && (
                        <span
                            className={classes(botTag.botTagVerified, botTag.botTagRegular, botTag.botTag, botTag.px, botTag.rem)}
                            style={{ marginLeft: "4px" }}>
                            <span className={botTag.botText}>
                                System
                            </span>
                        </span>
                    )}
                </div>
                {review.sender.badges.map(badge => <ReviewBadge {...badge} />)}

                {
                    !settings.store.hideTimestamps && review.type !== ReviewType.System && (
                        <Timestamp timestamp={moment(review.timestamp * 1000)} >
                            {dateFormat.format(review.timestamp * 1000)}
                        </Timestamp>)
                }

                <p
                    className={classes(messageContent)}
                    style={{ fontSize: 15, marginTop: 4, color: "var(--text-normal)" }}
                >
                    {review.comment}
                </p>
                {review.id !== 0 && (
                    <div className={classes(container, isHeader, buttons)} style={{
                        padding: "0px",
                    }}>
                        <div className={buttonClasses.wrapper} >
                            <ReportButton onClick={reportRev} />

                            {canDeleteReview(review, UserStore.getCurrentUser().id) && (
                                <DeleteButton onClick={delReview} />
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };
});
